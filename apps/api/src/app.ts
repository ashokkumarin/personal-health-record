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
    // The mobile app's PDF viewer renders documents via pdf.js's hosted
    // viewer page, which fetches the (signed, time-limited) file URL
    // client-side from its own origin — that fetch needs this origin
    // whitelisted, or the browser blocks it before our /files/* signature
    // check ever runs. This doesn't widen what's accessible: every other
    // route still requires a bearer token that this origin never has.
    origin: [process.env.WEB_ORIGIN ?? "http://localhost:3000", "https://mozilla.github.io"],
  });
  app.register(authRoutes);
  app.register(familiesRoutes);
  app.register(approvalsRoutes);
  app.register(recordsRoutes);
  app.register(usersRoutes);
  app.register(filesRoutes);
  return app;
}
