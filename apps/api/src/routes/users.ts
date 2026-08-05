import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { Prisma } from "@prisma/client";
import { updateProfileSchema, changePasswordSchema } from "@phr/shared";
import { recordAudit, sourceFromRequest } from "../audit.js";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "../auth-utils.js";
import { authenticate } from "../plugins/authenticate.js";
import { uploadObject, getSignedDownloadUrl } from "../storage.js";

const SUPPORTED_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

export type UploadedFilePart = { toBuffer: () => Promise<Buffer>; mimetype: string; filename: string };

// Shared by the self-service /users/me/photo route and the admin-on-behalf-of
// /admin/users/:id/photo route — same validation, storage key shape, and
// response shape either way.
export async function uploadAvatarForUser(userId: string, filePart: UploadedFilePart | undefined) {
  if (!filePart || !SUPPORTED_PHOTO_MIME_TYPES.has(filePart.mimetype)) {
    return null;
  }
  const buffer = await filePart.toBuffer();
  const key = `users/${userId}/${randomUUID()}-${filePart.filename}`;
  await uploadObject(key, buffer, filePart.mimetype);

  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarPath: key },
  });
  return buildUserResponse(user);
}

export async function buildUserResponse(user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarPath: string | null;
  themeColor: string | null;
  defaultTimelineView: string | null;
  dateOfBirth: Date | null;
  address: string | null;
  createdAt: Date;
  isAdmin?: boolean;
  mustChangePassword?: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    themeColor: user.themeColor,
    defaultTimelineView: user.defaultTimelineView,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString() : null,
    address: user.address,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: user.avatarPath ? await getSignedDownloadUrl(user.avatarPath) : null,
    isAdmin: user.isAdmin ?? false,
    mustChangePassword: user.mustChangePassword ?? false,
  };
}

export async function usersRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/users/me", async (request, reply) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.userId } });
    return reply.send(await buildUserResponse(user));
  });

  app.patch("/users/me", async (request, reply) => {
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    const { dateOfBirth, ...rest } = parsed.data;

    try {
      const user = await prisma.user.update({
        where: { id: request.userId },
        data: {
          ...rest,
          ...(dateOfBirth !== undefined ? { dateOfBirth: new Date(dateOfBirth) } : {}),
        },
      });
      return reply.send(await buildUserResponse(user));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return reply.code(409).send({ error: "EMAIL_ALREADY_REGISTERED" });
      }
      throw err;
    }
  });

  app.post("/users/me/password", async (request, reply) => {
    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.userId } });
    const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    await recordAudit({
      actorType: "USER",
      userId: user.id,
      eventType: "PASSWORD_CHANGED",
      entityType: "user",
      entityId: user.id,
      source: sourceFromRequest(request),
    });

    return reply.send({ ok: true });
  });

  app.register(async (instance) => {
    await instance.register(multipart, {
      attachFieldsToBody: true,
      limits: { fileSize: 5 * 1024 * 1024 },
    });

    instance.post("/users/me/photo", async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const filePart = body.file as UploadedFilePart | undefined;

      const updated = await uploadAvatarForUser(request.userId, filePart);
      if (!updated) {
        return reply.code(400).send({ error: "VALIDATION_ERROR" });
      }

      return reply.send(updated);
    });
  });
}
