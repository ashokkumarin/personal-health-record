import { buildApp } from "./app.js";
import { ensureBucket } from "./storage.js";

const port = Number(process.env.API_PORT ?? 4000);

ensureBucket()
  .catch((err) => {
    console.error("Failed to ensure MinIO bucket exists:", err);
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
