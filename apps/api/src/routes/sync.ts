import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import type { AuditSource } from "@prisma/client";
import { syncPushRequestSchema, type SyncMutationStatus } from "@phr/shared";
import { prisma } from "../db.js";
import { authenticate } from "../plugins/authenticate.js";
import { recordAudit, sourceFromRequest } from "../audit.js";

async function touchDevice(userId: string, deviceId: string) {
  await prisma.device.upsert({
    where: { installId: deviceId },
    update: { userId, lastSyncedAt: new Date() },
    create: { installId: deviceId, userId, lastSyncedAt: new Date() },
  });
}

async function isFamilyMember(familyId: string, userId: string) {
  const membership = await prisma.familyMembership.findFirst({
    where: { familyId, userId, deletedAt: null },
  });
  return membership !== null;
}

async function canManageRecord(
  record: { createdById: string },
  patient: { familyId: string; linkedUserId: string | null },
  userId: string
) {
  if (record.createdById === userId) return true;
  if (patient.linkedUserId === userId) return true;
  const membership = await prisma.familyMembership.findFirst({
    where: { familyId: patient.familyId, userId, deletedAt: null },
  });
  return membership !== null && (membership.role === "OWNER" || membership.role === "ADMIN");
}

export async function syncRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // Mobile devices call these on every sync-interval tick (see
  // apps/mobile/lib/sync/syncContext.tsx) — a misconfigured or malicious
  // client hammering /sync/push in a loop could otherwise generate unbounded
  // write load. Keyed on the authenticated user rather than IP, since
  // multiple family members' devices can share a NAT'd IP.
  await app.register(rateLimit, {
    max: 60,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.userId ?? request.ip,
  });

  app.get<{ Querystring: { since?: string; deviceId: string } }>(
    "/sync/pull",
    async (request, reply) => {
      const { since, deviceId } = request.query;
      if (!deviceId) {
        return reply.code(400).send({ error: "VALIDATION_ERROR" });
      }
      await touchDevice(request.userId, deviceId);

      const sinceDate = since ? new Date(since) : undefined;
      const serverTime = new Date();

      // Scope: families the caller is currently an active member of. If
      // access to a family is later revoked, sync simply stops advancing for
      // it rather than retroactively tombstoning everything the client
      // already has — a deliberate simplification given this app's low
      // multi-tenant complexity (personal/family use, not a shared platform).
      const activeMemberships = await prisma.familyMembership.findMany({
        where: { userId: request.userId, deletedAt: null },
      });
      const familyIds = activeMemberships.map((m) => m.familyId);

      const families = await prisma.family.findMany({
        where: {
          id: { in: familyIds },
          ...(sinceDate ? { updatedAt: { gt: sinceDate } } : {}),
        },
      });

      // The caller's own membership rows, independent of family scope above,
      // so a removal (deletedAt set) is still delivered as a tombstone.
      const memberships = await prisma.familyMembership.findMany({
        where: {
          userId: request.userId,
          ...(sinceDate ? { updatedAt: { gt: sinceDate } } : {}),
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      const patients = await prisma.patientProfile.findMany({
        where: {
          familyId: { in: familyIds },
          ...(sinceDate ? { updatedAt: { gt: sinceDate } } : {}),
        },
      });

      // Record visibility follows the same rule as GET /families/:id/records
      // (records.ts) — recomputed here against ALL patients in scope (not
      // just ones changed since the cursor) since visibility itself isn't
      // versioned.
      const allPatients = await prisma.patientProfile.findMany({
        where: { familyId: { in: familyIds } },
      });
      const visiblePatientIds = allPatients
        .filter(
          (p) =>
            p.linkedUserId === null || p.linkedUserId === request.userId || p.visibleToFamily
        )
        .map((p) => p.id);

      const records = await prisma.medicalRecord.findMany({
        where: {
          patientId: { in: visiblePatientIds },
          ...(sinceDate ? { updatedAt: { gt: sinceDate } } : {}),
        },
      });

      return reply.send({
        serverTime: serverTime.toISOString(),
        families: families.map((f) => ({ ...f, deleted: f.deletedAt !== null })),
        memberships: memberships.map((m) => ({ ...m, deleted: m.deletedAt !== null })),
        patients: patients.map((p) => ({ ...p, deleted: p.deletedAt !== null })),
        records: records.map((r) => ({ ...r, deleted: r.deletedAt !== null })),
      });
    }
  );

  app.post("/sync/push", async (request, reply) => {
    const parsed = syncPushRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }
    const { deviceId, mutations } = parsed.data;
    await touchDevice(request.userId, deviceId);

    const source = sourceFromRequest(request);
    const results: { clientId: string; status: SyncMutationStatus }[] = [];

    for (const mutation of mutations) {
      const status = await applyMutation(mutation, request.userId, source);
      results.push({ clientId: mutation.clientId, status });
    }

    return reply.send({ serverTime: new Date().toISOString(), results });
  });

  async function applyMutation(
    mutation: { clientId: string; op: string; data: Record<string, unknown>; updatedAt: string },
    userId: string,
    source: AuditSource
  ): Promise<SyncMutationStatus> {
    const data = mutation.data as {
      id?: string;
      patientId?: string;
      recordType?: string;
      title?: string;
      fileType?: string;
      capturedAt?: string | null;
    };

    if (mutation.op === "create") {
      if (!data.id || !data.patientId || !data.recordType || !data.title || !data.fileType) {
        return "rejected";
      }
      const existing = await prisma.medicalRecord.findUnique({ where: { id: data.id } });
      if (existing) return "applied"; // idempotent retry

      const patient = await prisma.patientProfile.findFirst({
        where: { id: data.patientId, deletedAt: null },
      });
      if (!patient) return "rejected";
      if (!(await isFamilyMember(patient.familyId, userId))) return "rejected";

      await prisma.medicalRecord.create({
        data: {
          id: data.id,
          patientId: data.patientId,
          recordType: data.recordType as never,
          title: data.title,
          // Placeholder — the client uploads the actual file bytes via the
          // existing PUT /records/:id/file route right after this push
          // succeeds (see SyncEngine); file mutations never ride in the
          // push JSON payload.
          filePath: "pending",
          fileType: data.fileType,
          capturedAt: data.capturedAt ? new Date(data.capturedAt) : undefined,
          createdById: userId,
        },
      });
      await recordAudit({
        actorType: "USER",
        userId,
        eventType: "UPLOAD",
        entityType: "record",
        entityId: data.id,
        metadata: { patientId: data.patientId, viaSync: true },
        source,
      });
      return "applied";
    }

    const recordId = data.id;
    if (!recordId) return "rejected";
    const record = await prisma.medicalRecord.findFirst({
      where: { id: recordId },
      include: { patient: true },
    });
    if (!record) return mutation.op === "delete" ? "applied" : "rejected";
    if (!(await canManageRecord(record, record.patient, userId))) return "rejected";

    if (record.updatedAt > new Date(mutation.updatedAt)) {
      return "stale";
    }

    if (mutation.op === "update") {
      await prisma.medicalRecord.update({
        where: { id: recordId },
        data: {
          ...(data.recordType ? { recordType: data.recordType as never } : {}),
          ...(data.title ? { title: data.title } : {}),
          ...(data.capturedAt !== undefined
            ? { capturedAt: data.capturedAt ? new Date(data.capturedAt) : null }
            : {}),
        },
      });
      await recordAudit({
        actorType: "USER",
        userId,
        eventType: "EDIT",
        entityType: "record",
        entityId: recordId,
        metadata: { viaSync: true },
        source,
      });
      return "applied";
    }

    if (mutation.op === "delete") {
      if (!record.deletedAt) {
        await prisma.medicalRecord.update({
          where: { id: recordId },
          data: { deletedAt: new Date() },
        });
        await recordAudit({
          actorType: "USER",
          userId,
          eventType: "DELETE",
          entityType: "record",
          entityId: recordId,
          metadata: { viaSync: true },
          source,
        });
      }
      return "applied";
    }

    return "rejected";
  }
}
