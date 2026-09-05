import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 20000,
    // Run all test files inside a single forked process.
    // This is required because better-sqlite3 is a native C++ addon that
    // cannot safely be loaded across multiple worker forks — doing so causes
    // SIGSEGV on Linux CI runners (Node.js ABI mismatch in the child process
    // memory space).  A single fork loads the addon once and shares it across
    // all test files, eliminating the crash without disabling any test.
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/core/**/*.ts"],
      exclude: ["src/core/audit.ts"], // requires SQLite, covered by integration
    },
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
});
