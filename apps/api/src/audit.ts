import type { FastifyRequest } from "fastify";
import type { AuditActorType, AuditEventType, AuditSource } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

// Mobile/web send this so audit rows can distinguish where an action came
// from; defaults to API for direct/unlabeled callers (e.g. scripts, curl).
export function sourceFromRequest(request: FastifyRequest): AuditSource {
  const header = request.headers["x-client"];
  const value = Array.isArray(header) ? header[0] : header;
  if (value === "web") return "WEB";
  if (value === "mobile") return "MOBILE";
  return "API";
}

export async function recordAudit(params: {
  actorType: AuditActorType;
  userId?: string;
  eventType: AuditEventType;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  source: AuditSource;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: params.actorType,
        userId: params.userId,
        eventType: params.eventType,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
        source: params.source,
      },
    });
  } catch {
    // Audit logging must never take down the primary request.
  }
}
