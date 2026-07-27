import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken } from "../auth-utils.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    return reply.code(401).send({ error: "UNAUTHENTICATED" });
  }

  try {
    const payload = verifyToken(token);
    request.userId = payload.sub;
  } catch {
    return reply.code(401).send({ error: "UNAUTHENTICATED" });
  }
}
