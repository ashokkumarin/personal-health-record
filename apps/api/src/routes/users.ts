import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { Prisma } from "@prisma/client";
import { updateProfileSchema, changePasswordSchema } from "@phr/shared";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "../auth-utils.js";
import { authenticate } from "../plugins/authenticate.js";
import { uploadObject, getSignedDownloadUrl } from "../storage.js";

const SUPPORTED_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

async function buildUserResponse(user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarPath: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: user.avatarPath ? await getSignedDownloadUrl(user.avatarPath) : null,
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

    try {
      const user = await prisma.user.update({
        where: { id: request.userId },
        data: parsed.data,
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
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    return reply.send({ ok: true });
  });

  app.register(async (instance) => {
    await instance.register(multipart, {
      attachFieldsToBody: true,
      limits: { fileSize: 5 * 1024 * 1024 },
    });

    instance.post("/users/me/photo", async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const filePart = body.file as
        | { toBuffer: () => Promise<Buffer>; mimetype: string; filename: string }
        | undefined;

      if (!filePart || !SUPPORTED_PHOTO_MIME_TYPES.has(filePart.mimetype)) {
        return reply.code(400).send({ error: "VALIDATION_ERROR" });
      }

      const buffer = await filePart.toBuffer();
      const key = `users/${request.userId}/${randomUUID()}-${filePart.filename}`;
      await uploadObject(key, buffer, filePart.mimetype);

      const user = await prisma.user.update({
        where: { id: request.userId },
        data: { avatarPath: key },
      });

      return reply.send(await buildUserResponse(user));
    });
  });
}
