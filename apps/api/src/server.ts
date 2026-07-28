import { buildApp } from "./app.js";
import { ensureMediaRoot } from "./storage.js";

const port = Number(process.env.API_PORT ?? 4000);

ensureMediaRoot()
  .catch((err) => {
    console.error("Failed to create media storage directory:", err);
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
