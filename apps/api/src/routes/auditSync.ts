import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { auditSyncRequestSchema } from "@phr/shared";
import { prisma } from "../db.js";
import { authenticate } from "../plugins/authenticate.js";

export async function auditSyncRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.post("/audit/sync", async (request, reply) => {
    const parsed = auditSyncRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }
    const { deviceId, entries } = parsed.data;

    let applied = 0;
    for (const entry of entries) {
      try {
        await prisma.auditLog.create({
          data: {
            actorType: entry.actorType,
            userId: request.userId,
            deviceId,
            eventType: entry.eventType,
            entityType: entry.entityType,
            entityId: entry.entityId,
            metadata: entry.metadata as Prisma.InputJsonValue | undefined,
            source: "MOBILE",
            clientId: entry.clientId,
            createdAt: new Date(entry.occurredAt),
          },
        });
        applied++;
      } catch (err) {
        // Duplicate clientId means this entry was already applied in a
        // previous (retried) sync — safe to skip, not a real failure.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          continue;
        }
        throw err;
      }
    }

    return reply.send({ applied });
  });
}
