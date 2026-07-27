import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    hookTimeout: 20000,
    // Test files share one real Postgres and each truncates shared tables in
    // beforeEach; running files in parallel causes cross-file data races.
    fileParallelism: false,
  },
});
