import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

describe("fixture reproducibility", () => {
  it("data/input CSVs exist after generate:data", () => {
    // Run the generator
    execSync("npx tsx scripts/generate-fixture.ts", { stdio: "pipe" });
    expect(existsSync("data/input/settlement_recon.csv")).toBe(true);
    expect(existsSync("data/input/merchant_ledger.csv")).toBe(true);
    expect(existsSync("data/input/bank_credits.csv")).toBe(true);
    expect(existsSync("data/truth/expected_outcomes.csv")).toBe(true);
  });

  it("settlement CSV has 120 rows", () => {
    const content = readFileSync("data/input/settlement_recon.csv", "utf-8");
    const lines = content.trim().split("\n");
    // 1 header + 120 data rows
    expect(lines.length).toBe(121);
  });

  it("truth CSV has 120 rows", () => {
    const content = readFileSync("data/truth/expected_outcomes.csv", "utf-8");
    const lines = content.trim().split("\n");
    expect(lines.length).toBe(121);
  });

  it("re-running the generator produces an identical SHA-256", () => {
    const s1 = readFileSync("data/input/settlement_recon.csv", "utf-8");
    const l1 = readFileSync("data/input/merchant_ledger.csv", "utf-8");
    const b1 = readFileSync("data/input/bank_credits.csv", "utf-8");
    const hash1 = createHash("sha256").update(s1 + l1 + b1).digest("hex");

    execSync("npx tsx scripts/generate-fixture.ts", { stdio: "pipe" });

    const s2 = readFileSync("data/input/settlement_recon.csv", "utf-8");
    const l2 = readFileSync("data/input/merchant_ledger.csv", "utf-8");
    const b2 = readFileSync("data/input/bank_credits.csv", "utf-8");
    const hash2 = createHash("sha256").update(s2 + l2 + b2).digest("hex");

    expect(hash1).toBe(hash2);
  });
});
