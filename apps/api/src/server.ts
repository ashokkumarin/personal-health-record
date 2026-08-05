import { buildApp } from "./app.js";
import { ensureMediaRoot } from "./storage.js";
import { ensureAdminUser } from "./bootstrap.js";

const port = Number(process.env.API_PORT ?? 4000);

if (!process.env.JWT_SECRET) {
  console.warn(
    "WARNING: JWT_SECRET is not set. Falling back to an insecure default " +
      "that lets anyone forge login tokens for this instance. Set JWT_SECRET " +
      "to a long random value in your .env before exposing this server " +
      "beyond your own machine."
  );
}

ensureMediaRoot()
  .catch((err) => {
    console.error("Failed to create media storage directory:", err);
  })
  .then(() => ensureAdminUser())
  .catch((err) => {
    console.error("Failed to bootstrap admin account:", err);
  })
  .then(() =>
    buildApp().listen({ port, host: "0.0.0.0" })
  )
  .then(() => {
    console.log(`API listening on port ${port}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
