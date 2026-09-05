/**
 * scripts/evaluate.ts
 *
 * Runs the deterministic reconcile engine against the committed fixture inputs,
 * computes all metrics against the committed truth labels, and writes the result
 * to docs/metrics.json.
 *
 * This script is the ONLY place metrics are computed. The application reads
 * docs/metrics.json — it never hardcodes any number.
 *
 * Exit code 1 if any of the immutable headline numbers drift from the
 * expected values for this exact cohort (seed 20260904, 122 rows).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadFixtureInputs, loadTruth } from "../src/core/audit";
import { reconcile } from "../src/core/reconcile";
import { evaluate } from "../src/core/evaluate";

const input = await loadFixtureInputs();
const run = reconcile(input.settlementRows, input.ledgerRows, input.bankCredits);
const truth = await loadTruth();
const metrics = evaluate(run.results, truth);

// Compute input hash the same way the generator does (CSV strings concat)
const { readFileSync } = await import("node:fs");
const { join } = await import("node:path");
const s = readFileSync(join(process.cwd(), "data/input/settlement_recon.csv"), "utf-8");
const l = readFileSync(join(process.cwd(), "data/input/merchant_ledger.csv"), "utf-8");
const b = readFileSync(join(process.cwd(), "data/input/bank_credits.csv"), "utf-8");
const inputSha256 = createHash("sha256").update(s + l + b).digest("hex");

// ════════════════════════════════════════════════════════════════════════════
// Immutable headline assertions for seed 20260904.
// If these drift the build must fail so README/UI numbers
// cannot silently diverge from what the code actually does.
// Rows 121–122 are the two novel-pattern rows added in Task 1; the taxonomy
// metrics are asserted only over the 120 baseline rows.
// ════════════════════════════════════════════════════════════════════════════
const expected = {
  total: 122,
  taxonomyTotal: 120,
  novelPatternRows: 2,
  correctClosed: 97,
  conservativeAbstentions: 3,
  falseClosures: 0,
  closeRecall: 1,          // 97/97 = 100% strict recall (taxonomy rows)
  closePrecision: 1,       // 97/97 = 100% precision (taxonomy rows)
  hardExceptionRecall: 1,  // 20/20 = 100% (taxonomy rows)
  novelPatternSafeAbstentions: 2,   // both novel rows correctly produce EXCEPTION
  novelPatternFalseClosures: 0,     // engine must not force-close either novel row
} as const;

let driftFound = false;
for (const [key, value] of Object.entries(expected)) {
  const actual = metrics[key as keyof typeof metrics];
  if (actual !== value) {
    console.error(`Metric drift: ${key}; expected ${value}, got ${actual}`);
    driftFound = true;
  }
}
if (driftFound) process.exit(1);

// Write complete metrics + provenance — the UI reads this, never any hardcoded prose
const output = {
  ...metrics,
  // Provenance fields
  runId: run.runId,
  algorithmVersion: run.algorithmVersion,
  inputSha256,
  cohortSeed: 20260904,
  cohortRows: 122,
  generatedAt: new Date().toISOString(),
};

mkdirSync("docs", { recursive: true });
writeFileSync("docs/metrics.json", JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
