import Fastify from "fastify";
import cors from "@fastify/cors";
import { authRoutes } from "./routes/auth.js";
import { familiesRoutes } from "./routes/families.js";
import { approvalsRoutes } from "./routes/approvals.js";
import { recordsRoutes } from "./routes/records.js";
import { usersRoutes } from "./routes/users.js";
import { filesRoutes } from "./routes/files.js";

export function buildApp() {
  const app = Fastify({ logger: false });
  app.register(cors, {
    origin: [process.env.WEB_ORIGIN ?? "http://localhost:3000"],
  });
  app.register(authRoutes);
  app.register(familiesRoutes);
  app.register(approvalsRoutes);
  app.register(recordsRoutes);
  app.register(usersRoutes);
  app.register(filesRoutes);
  return app;
}
