import type { FastifyInstance } from "fastify";
import { registerSchema, loginSchema, forgotPasswordSchema } from "@phr/shared";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword, signToken } from "../auth-utils.js";
import { buildUserResponse } from "./users.js";
import { recordAudit, sourceFromRequest } from "../audit.js";
import { authenticate } from "../plugins/authenticate.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: "EMAIL_ALREADY_REGISTERED" });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });

    const token = signToken({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    });

    await recordAudit({
      actorType: "USER",
      userId: user.id,
      eventType: "REGISTER",
      entityType: "user",
      entityId: user.id,
      source: sourceFromRequest(request),
    });

    return reply.code(201).send({
      user: await buildUserResponse(user),
      token,
    });
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) {
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }

    const token = signToken({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    });

    await recordAudit({
      actorType: "USER",
      userId: user.id,
      eventType: "LOGIN",
      entityType: "user",
      entityId: user.id,
      source: sourceFromRequest(request),
    });

    return reply.send({
      user: await buildUserResponse(user),
      token,
    });
  });

  // Public — no email infra exists, so "forgot password" doesn't send
  // anything itself. It just queues a request the admin can see and resolve
  // (POST /admin/password-reset-requests/:id/resolve). Always responds with
  // the same generic body so this can't be used to enumerate registered
  // emails.
  app.post("/auth/forgot-password", async (request, reply) => {
    const parsed = forgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (user && !user.deletedAt) {
      await prisma.passwordResetRequest.create({ data: { userId: user.id } });
      await recordAudit({
        actorType: "USER",
        userId: user.id,
        eventType: "PASSWORD_RESET_REQUESTED",
        entityType: "user",
        entityId: user.id,
        source: sourceFromRequest(request),
      });
    }

    return reply.send({ ok: true });
  });

  app.post("/auth/logout", { preHandler: authenticate }, async (request, reply) => {
    // Stateless JWT — there's no session to invalidate server-side. This
    // endpoint's only real job is recording the audit event; the client
    // discards its token regardless of what we return.
    await recordAudit({
      actorType: "USER",
      userId: request.userId,
      eventType: "LOGOUT",
      entityType: "user",
      entityId: request.userId,
      source: sourceFromRequest(request),
    });
    return reply.send({ ok: true });
  });
}
