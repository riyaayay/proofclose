import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 20000,
    // Run every test file in a single forked process (not N separate forks).
    // better-sqlite3 is a native C++ addon.  When vitest spawns a new fork for
    // each test file the addon can SIGSEGV if the child ABI doesn't exactly
    // match the prebuilt .node binary.  singleFork loads the addon once and
    // shares it, eliminating the crash without disabling any test.
    // Note: poolOptions was removed in vitest v4; singleFork is now top-level.
    pool: "forks",
    singleFork: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/core/**/*.ts"],
      exclude: ["src/core/audit.ts"], // requires SQLite, covered by integration tests
    },
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
});
