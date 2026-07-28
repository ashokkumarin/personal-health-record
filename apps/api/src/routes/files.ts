import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { resolveMediaPath, contentTypeForKey, verifyFileSignature } from "../storage.js";

export async function filesRoutes(app: FastifyInstance) {
  app.get<{ Params: { "*": string }; Querystring: { expires?: string; sig?: string } }>(
    "/files/*",
    async (request, reply) => {
      const key = request.params["*"];
      const { expires, sig } = request.query;

      if (!verifyFileSignature(key, expires, sig)) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }

      let filePath: string;
      try {
        filePath = resolveMediaPath(key);
        await stat(filePath);
      } catch {
        return reply.code(404).send({ error: "NOT_FOUND" });
      }

      reply.type(contentTypeForKey(key));
      return reply.send(createReadStream(filePath));
    }
  );
}
