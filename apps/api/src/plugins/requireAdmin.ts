import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../db.js";

// Runs after `authenticate`. Checks isAdmin against the DB rather than the
// JWT payload so revoking admin access takes effect on the very next
// request instead of waiting out the token's 7-day expiry.
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const user = await prisma.user.findUnique({
    where: { id: request.userId },
    select: { isAdmin: true, deletedAt: true },
  });
  if (!user || user.deletedAt || !user.isAdmin) {
    return reply.code(403).send({ error: "FORBIDDEN" });
  }
}
