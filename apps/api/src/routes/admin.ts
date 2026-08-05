import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { Prisma } from "@prisma/client";
import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
  adminResetPasswordSchema,
  auditLogQuerySchema,
} from "@phr/shared";
import { prisma } from "../db.js";
import { hashPassword } from "../auth-utils.js";
import { authenticate } from "../plugins/authenticate.js";
import { requireAdmin } from "../plugins/requireAdmin.js";
import { recordAudit, sourceFromRequest } from "../audit.js";
import { buildUserResponse, uploadAvatarForUser, type UploadedFilePart } from "./users.js";

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireAdmin);

  app.get("/admin/users", async (_request, reply) => {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        familyMemberships: {
          where: { deletedAt: null },
          include: { family: { select: { id: true, name: true } } },
        },
      },
    });

    return reply.send(
      await Promise.all(
        users.map(async (user) => ({
          ...(await buildUserResponse(user)),
          families: user.familyMemberships
            .filter((m) => m.family)
            .map((m) => ({ id: m.family.id, name: m.family.name, role: m.role })),
        }))
      )
    );
  });

  app.post("/admin/users", async (request, reply) => {
    const parsed = adminCreateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    const { name, email, password, forceChangePassword } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: "EMAIL_ALREADY_REGISTERED" });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, mustChangePassword: forceChangePassword },
    });

    await recordAudit({
      actorType: "USER",
      userId: request.userId,
      eventType: "ADMIN_CREATE_USER",
      entityType: "user",
      entityId: user.id,
      metadata: { name, email, forceChangePassword },
      source: sourceFromRequest(request),
    });

    return reply.code(201).send(await buildUserResponse(user));
  });

  app.patch<{ Params: { id: string } }>("/admin/users/:id", async (request, reply) => {
    const parsed = adminUpdateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    const target = await prisma.user.findFirst({
      where: { id: request.params.id, deletedAt: null },
    });
    if (!target) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }
    if (target.isAdmin) {
      return reply.code(400).send({ error: "CANNOT_MODIFY_ADMIN" });
    }

    const { dateOfBirth, ...rest } = parsed.data;

    try {
      const user = await prisma.user.update({
        where: { id: target.id },
        data: {
          ...rest,
          ...(dateOfBirth !== undefined ? { dateOfBirth: new Date(dateOfBirth) } : {}),
        },
      });

      await recordAudit({
        actorType: "USER",
        userId: request.userId,
        eventType: "ADMIN_UPDATE_USER",
        entityType: "user",
        entityId: user.id,
        metadata: { fields: Object.keys(parsed.data) },
        source: sourceFromRequest(request),
      });

      return reply.send(await buildUserResponse(user));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return reply.code(409).send({ error: "EMAIL_ALREADY_REGISTERED" });
      }
      throw err;
    }
  });

  app.register(async (instance) => {
    await instance.register(multipart, {
      attachFieldsToBody: true,
      limits: { fileSize: 5 * 1024 * 1024 },
    });

    instance.post<{ Params: { id: string } }>("/admin/users/:id/photo", async (request, reply) => {
      const target = await prisma.user.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!target) {
        return reply.code(404).send({ error: "NOT_FOUND" });
      }
      if (target.isAdmin) {
        return reply.code(400).send({ error: "CANNOT_MODIFY_ADMIN" });
      }

      const body = request.body as Record<string, unknown>;
      const filePart = body.file as UploadedFilePart | undefined;

      const updated = await uploadAvatarForUser(target.id, filePart);
      if (!updated) {
        return reply.code(400).send({ error: "VALIDATION_ERROR" });
      }

      await recordAudit({
        actorType: "USER",
        userId: request.userId,
        eventType: "ADMIN_UPDATE_USER",
        entityType: "user",
        entityId: target.id,
        metadata: { fields: ["photo"] },
        source: sourceFromRequest(request),
      });

      return reply.send(updated);
    });
  });

  app.post<{ Params: { id: string } }>(
    "/admin/users/:id/reset-password",
    async (request, reply) => {
      const parsed = adminResetPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
      }

      const target = await prisma.user.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!target) {
        return reply.code(404).send({ error: "NOT_FOUND" });
      }
      if (target.isAdmin) {
        return reply.code(400).send({ error: "CANNOT_MODIFY_ADMIN" });
      }

      const passwordHash = await hashPassword(parsed.data.newPassword);
      await prisma.user.update({
        where: { id: target.id },
        data: { passwordHash, mustChangePassword: true },
      });

      await recordAudit({
        actorType: "USER",
        userId: request.userId,
        eventType: "ADMIN_RESET_PASSWORD",
        entityType: "user",
        entityId: target.id,
        metadata: { name: target.name, email: target.email },
        source: sourceFromRequest(request),
      });

      return reply.send({ ok: true });
    }
  );

  app.delete<{ Params: { id: string } }>("/admin/users/:id", async (request, reply) => {
    const targetId = request.params.id;

    if (targetId === request.userId) {
      return reply.code(400).send({ error: "CANNOT_DELETE_SELF" });
    }

    const target = await prisma.user.findFirst({ where: { id: targetId, deletedAt: null } });
    if (!target) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }
    if (target.isAdmin) {
      return reply.code(400).send({ error: "CANNOT_MODIFY_ADMIN" });
    }

    const ownedFamilies = await prisma.family.findMany({
      where: { ownerId: targetId, deletedAt: null },
      include: { memberships: { where: { deletedAt: null } } },
    });
    const blockingFamily = ownedFamilies.find((f) =>
      f.memberships.some((m) => m.userId !== targetId)
    );
    if (blockingFamily) {
      return reply.code(400).send({ error: "CANNOT_REMOVE_OWNER" });
    }

    const summary = await prisma.$transaction(async (tx) => {
      const soloFamilyIds = ownedFamilies.map((f) => f.id);

      const patientIds = soloFamilyIds.length
        ? (
            await tx.patientProfile.findMany({
              where: { familyId: { in: soloFamilyIds }, deletedAt: null },
              select: { id: true },
            })
          ).map((p) => p.id)
        : [];

      const selfProfile = await tx.patientProfile.findFirst({
        where: { linkedUserId: targetId, deletedAt: null },
      });
      if (selfProfile && !patientIds.includes(selfProfile.id)) {
        patientIds.push(selfProfile.id);
      }

      let recordCount = 0;
      if (patientIds.length) {
        const result = await tx.medicalRecord.updateMany({
          where: { patientId: { in: patientIds }, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        recordCount = result.count;

        await tx.patientProfile.updateMany({
          where: { id: { in: patientIds } },
          data: { deletedAt: new Date() },
        });
      }

      if (soloFamilyIds.length) {
        await tx.family.updateMany({
          where: { id: { in: soloFamilyIds } },
          data: { deletedAt: new Date() },
        });
      }

      await tx.familyMembership.updateMany({
        where: { userId: targetId, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      await tx.user.update({
        where: { id: targetId },
        data: { deletedAt: new Date() },
      });

      return {
        name: target.name,
        email: target.email,
        familiesDeleted: soloFamilyIds.length,
        patientsDeleted: patientIds.length,
        recordsDeleted: recordCount,
      };
    });

    await recordAudit({
      actorType: "USER",
      userId: request.userId,
      eventType: "ADMIN_DELETE_USER",
      entityType: "user",
      entityId: targetId,
      metadata: summary,
      source: sourceFromRequest(request),
    });

    return reply.code(204).send();
  });

  app.get("/admin/audit-log", async (request, reply) => {
    const parsed = auditLogQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }
    const { userId, eventType, since, until, limit, cursor } = parsed.data;

    const entries = await prisma.auditLog.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(eventType ? { eventType } : {}),
        ...(since || until
          ? {
              createdAt: {
                ...(since ? { gte: new Date(since) } : {}),
                ...(until ? { lte: new Date(until) } : {}),
              },
            }
          : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    return reply.send({
      entries,
      nextCursor: entries.length === limit ? entries[entries.length - 1].id : null,
    });
  });

  app.get("/admin/password-reset-requests", async (_request, reply) => {
    const requests = await prisma.passwordResetRequest.findMany({
      where: { status: "PENDING" },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    return reply.send(requests);
  });

  app.post<{ Params: { id: string } }>(
    "/admin/password-reset-requests/:id/resolve",
    async (request, reply) => {
      const parsed = adminResetPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
      }

      const resetRequest = await prisma.passwordResetRequest.findFirst({
        where: { id: request.params.id, status: "PENDING" },
      });
      if (!resetRequest) {
        return reply.code(404).send({ error: "NOT_FOUND" });
      }

      const target = await prisma.user.findFirst({
        where: { id: resetRequest.userId, deletedAt: null },
      });
      if (!target) {
        return reply.code(404).send({ error: "NOT_FOUND" });
      }
      if (target.isAdmin) {
        return reply.code(400).send({ error: "CANNOT_MODIFY_ADMIN" });
      }

      const passwordHash = await hashPassword(parsed.data.newPassword);
      await prisma.$transaction([
        prisma.user.update({
          where: { id: target.id },
          data: { passwordHash, mustChangePassword: true },
        }),
        prisma.passwordResetRequest.update({
          where: { id: resetRequest.id },
          data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: request.userId },
        }),
      ]);

      await recordAudit({
        actorType: "USER",
        userId: request.userId,
        eventType: "ADMIN_RESET_PASSWORD",
        entityType: "user",
        entityId: target.id,
        metadata: { name: target.name, email: target.email, viaRequestId: resetRequest.id },
        source: sourceFromRequest(request),
      });

      return reply.send({ ok: true });
    }
  );
}
