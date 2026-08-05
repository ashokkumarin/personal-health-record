import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { updateRecordFieldsSchema } from "@phr/shared";
import { prisma } from "../db.js";
import { authenticate } from "../plugins/authenticate.js";
import { recordAudit, sourceFromRequest } from "../audit.js";
import { uploadObject, getSignedDownloadUrl, deleteObject } from "../storage.js";
import { extractText } from "../ocr.js";
import { generateThumbnail } from "../thumbnail.js";

const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const RECORD_TYPES = new Set(["PRESCRIPTION", "LAB_REPORT", "PHARMACY_BILL", "NOTE"]);

function fieldValue(field: unknown): string | undefined {
  if (field && typeof field === "object" && "value" in field) {
    return (field as { value: string }).value;
  }
  return undefined;
}

async function isFamilyMember(familyId: string, userId: string) {
  const membership = await prisma.familyMembership.findFirst({
    where: { familyId, userId, deletedAt: null },
  });
  return membership !== null;
}

async function isFamilyManager(familyId: string, userId: string) {
  const membership = await prisma.familyMembership.findFirst({
    where: { familyId, userId, deletedAt: null },
  });
  return membership !== null && (membership.role === "OWNER" || membership.role === "ADMIN");
}

function isRecordVisible(
  patient: { linkedUserId: string | null; visibleToFamily: boolean },
  requesterId: string
) {
  return (
    patient.linkedUserId === null ||
    patient.linkedUserId === requesterId ||
    patient.visibleToFamily
  );
}

async function canManageRecord(
  record: { createdById: string },
  patient: { familyId: string; linkedUserId: string | null },
  userId: string
) {
  if (record.createdById === userId) return true;
  if (patient.linkedUserId === userId) return true;
  return isFamilyManager(patient.familyId, userId);
}

async function withThumbnailUrl<T extends { thumbnailPath: string | null }>(
  record: T
): Promise<T & { thumbnailUrl: string | null }> {
  return {
    ...record,
    thumbnailUrl: record.thumbnailPath ? await getSignedDownloadUrl(record.thumbnailPath) : null,
  };
}

async function uploadWithThumbnail(key: string, buffer: Buffer, mimetype: string) {
  await uploadObject(key, buffer, mimetype);
  const thumbnailBuffer = await generateThumbnail(buffer, mimetype);
  if (!thumbnailBuffer) {
    return { thumbnailPath: null as string | null };
  }
  const thumbnailPath = `thumbnails/${key}.jpg`;
  await uploadObject(thumbnailPath, thumbnailBuffer, "image/jpeg");
  return { thumbnailPath };
}

export async function recordsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.register(async (instance) => {
    await instance.register(multipart, {
      attachFieldsToBody: true,
      limits: { fileSize: 25 * 1024 * 1024 },
    });

    instance.post<{ Params: { patientId: string } }>(
      "/patients/:patientId/records",
      async (request, reply) => {
        const patient = await prisma.patientProfile.findFirst({
          where: { id: request.params.patientId, deletedAt: null },
        });
        if (!patient) {
          return reply.code(404).send({ error: "NOT_FOUND" });
        }
        if (!(await isFamilyMember(patient.familyId, request.userId))) {
          return reply.code(403).send({ error: "FORBIDDEN" });
        }

        const body = request.body as Record<string, unknown>;
        const filePart = body.file as
          | { toBuffer: () => Promise<Buffer>; mimetype: string; filename: string }
          | undefined;
        const recordType = fieldValue(body.recordType);
        const title = fieldValue(body.title);
        const capturedAtRaw = fieldValue(body.capturedAt);

        if (!filePart || !recordType || !title || !RECORD_TYPES.has(recordType)) {
          return reply.code(400).send({ error: "VALIDATION_ERROR" });
        }
        if (!SUPPORTED_MIME_TYPES.has(filePart.mimetype)) {
          return reply.code(400).send({ error: "VALIDATION_ERROR" });
        }

        const buffer = await filePart.toBuffer();
        const key = `${patient.id}/${randomUUID()}-${filePart.filename}`;
        const { thumbnailPath } = await uploadWithThumbnail(key, buffer, filePart.mimetype);

        const record = await prisma.medicalRecord.create({
          data: {
            patientId: patient.id,
            recordType: recordType as never,
            title,
            filePath: key,
            fileType: filePart.mimetype,
            thumbnailPath,
            capturedAt: capturedAtRaw ? new Date(capturedAtRaw) : undefined,
            createdById: request.userId,
          },
        });

        extractText(buffer, filePart.mimetype)
          .then((ocrText) => {
            if (ocrText) {
              return prisma.medicalRecord.update({ where: { id: record.id }, data: { ocrText } });
            }
          })
          .catch(() => {});

        await recordAudit({
          actorType: "USER",
          userId: request.userId,
          eventType: "UPLOAD",
          entityType: "record",
          entityId: record.id,
          metadata: { patientId: patient.id, title: record.title, recordType: record.recordType },
          source: sourceFromRequest(request),
        });

        return reply.code(201).send(await withThumbnailUrl(record));
      }
    );

    instance.put<{ Params: { id: string } }>("/records/:id/file", async (request, reply) => {
      const record = await prisma.medicalRecord.findFirst({
        where: { id: request.params.id, deletedAt: null },
        include: { patient: true },
      });
      if (!record) {
        return reply.code(404).send({ error: "NOT_FOUND" });
      }
      if (!(await canManageRecord(record, record.patient, request.userId))) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }

      const body = request.body as Record<string, unknown>;
      const filePart = body.file as
        | { toBuffer: () => Promise<Buffer>; mimetype: string; filename: string }
        | undefined;
      if (!filePart || !SUPPORTED_MIME_TYPES.has(filePart.mimetype)) {
        return reply.code(400).send({ error: "VALIDATION_ERROR" });
      }

      const buffer = await filePart.toBuffer();
      const newKey = `${record.patientId}/${randomUUID()}-${filePart.filename}`;
      const { thumbnailPath } = await uploadWithThumbnail(newKey, buffer, filePart.mimetype);

      const { filePath: oldFilePath, thumbnailPath: oldThumbnailPath } = record;

      const updated = await prisma.medicalRecord.update({
        where: { id: record.id },
        data: {
          filePath: newKey,
          fileType: filePart.mimetype,
          thumbnailPath,
          ocrText: null,
        },
      });

      await deleteObject(oldFilePath).catch(() => {});
      if (oldThumbnailPath) await deleteObject(oldThumbnailPath).catch(() => {});

      extractText(buffer, filePart.mimetype)
        .then((ocrText) => {
          if (ocrText) {
            return prisma.medicalRecord.update({ where: { id: record.id }, data: { ocrText } });
          }
        })
        .catch(() => {});

      await recordAudit({
        actorType: "USER",
        userId: request.userId,
        eventType: "EDIT",
        entityType: "record",
        entityId: record.id,
        metadata: { title: record.title, replacedFile: true },
        source: sourceFromRequest(request),
      });

      return reply.send(await withThumbnailUrl(updated));
    });
  });

  app.get("/me/timeline", async (request, reply) => {
    const patient = await prisma.patientProfile.findFirst({
      where: { linkedUserId: request.userId, deletedAt: null },
    });
    if (!patient) {
      return reply.send({ patient: null, records: [] });
    }

    const records = await prisma.medicalRecord.findMany({
      where: { patientId: patient.id, deletedAt: null },
      orderBy: [{ capturedAt: { sort: "desc", nulls: "last" } }, { uploadedAt: "desc" }],
    });

    return reply.send({ patient, records: await Promise.all(records.map(withThumbnailUrl)) });
  });

  app.get<{ Params: { id: string } }>("/records/:id", async (request, reply) => {
    const record = await prisma.medicalRecord.findFirst({
      where: { id: request.params.id, deletedAt: null },
      include: { patient: true },
    });
    if (!record) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }
    if (!(await isFamilyMember(record.patient.familyId, request.userId))) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }
    if (!isRecordVisible(record.patient, request.userId)) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }

    const downloadUrl = await getSignedDownloadUrl(record.filePath);
    return reply.send({ ...(await withThumbnailUrl(record)), downloadUrl });
  });

  app.get<{
    Params: { familyId: string };
    Querystring: {
      patientId?: string;
      recordType?: string;
      dateFrom?: string;
      dateTo?: string;
      q?: string;
    };
  }>("/families/:familyId/records", async (request, reply) => {
    const { familyId } = request.params;
    if (!(await isFamilyMember(familyId, request.userId))) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }

    const patients = await prisma.patientProfile.findMany({ where: { familyId, deletedAt: null } });
    const patientById = new Map(patients.map((p) => [p.id, p]));

    let visiblePatientIds = patients
      .filter((p) => isRecordVisible(p, request.userId))
      .map((p) => p.id);

    const { patientId, recordType, dateFrom, dateTo, q } = request.query;

    if (patientId) {
      if (!patientById.has(patientId)) {
        return reply.code(404).send({ error: "NOT_FOUND" });
      }
      visiblePatientIds = visiblePatientIds.filter((id) => id === patientId);
    }

    const capturedAtFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) capturedAtFilter.gte = new Date(dateFrom);
    if (dateTo) capturedAtFilter.lte = new Date(dateTo);

    const records = await prisma.medicalRecord.findMany({
      where: {
        patientId: { in: visiblePatientIds },
        deletedAt: null,
        ...(recordType ? { recordType: recordType as never } : {}),
        ...(dateFrom || dateTo ? { capturedAt: capturedAtFilter } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { ocrText: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ capturedAt: { sort: "desc", nulls: "last" } }, { uploadedAt: "desc" }],
    });

    return reply.send(await Promise.all(records.map(withThumbnailUrl)));
  });

  app.patch<{ Params: { id: string }; Body: { visibleToFamily: boolean } }>(
    "/patients/:id/visibility",
    async (request, reply) => {
      const patient = await prisma.patientProfile.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!patient) {
        return reply.code(404).send({ error: "NOT_FOUND" });
      }
      if (patient.linkedUserId !== request.userId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }

      const updated = await prisma.patientProfile.update({
        where: { id: patient.id },
        data: { visibleToFamily: Boolean(request.body.visibleToFamily) },
      });

      return reply.send(updated);
    }
  );

  app.patch<{ Params: { id: string } }>("/records/:id", async (request, reply) => {
    const record = await prisma.medicalRecord.findFirst({
      where: { id: request.params.id, deletedAt: null },
      include: { patient: true },
    });
    if (!record) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }
    if (!(await canManageRecord(record, record.patient, request.userId))) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }

    const parsed = updateRecordFieldsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    const { recordType, title, capturedAt } = parsed.data;
    const updated = await prisma.medicalRecord.update({
      where: { id: record.id },
      data: {
        ...(recordType ? { recordType: recordType as never } : {}),
        ...(title ? { title } : {}),
        ...(capturedAt !== undefined ? { capturedAt: capturedAt ? new Date(capturedAt) : null } : {}),
      },
    });

    await recordAudit({
      actorType: "USER",
      userId: request.userId,
      eventType: "EDIT",
      entityType: "record",
      entityId: record.id,
      metadata: { title: updated.title, fields: Object.keys(parsed.data) },
      source: sourceFromRequest(request),
    });

    return reply.send(await withThumbnailUrl(updated));
  });

  app.delete<{ Params: { id: string } }>("/records/:id", async (request, reply) => {
    const record = await prisma.medicalRecord.findFirst({
      where: { id: request.params.id, deletedAt: null },
      include: { patient: true },
    });
    if (!record) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }
    if (!(await canManageRecord(record, record.patient, request.userId))) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }

    // Soft delete: a sync client needs a tombstone to learn this record is
    // gone (see AuditLog/Device, Phase 4 sync). Storage blobs are left in
    // place for now — immediate deletion would 404 a signed URL a client
    // fetches mid-sync; cleanup of orphaned blobs is a separate concern.
    await prisma.medicalRecord.update({
      where: { id: record.id },
      data: { deletedAt: new Date() },
    });

    await recordAudit({
      actorType: "USER",
      userId: request.userId,
      eventType: "DELETE",
      entityType: "record",
      entityId: record.id,
      metadata: { title: record.title, patientId: record.patientId },
      source: sourceFromRequest(request),
    });

    return reply.code(204).send();
  });
}
