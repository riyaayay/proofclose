import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { generateBenchmarkCohort } from "@/core/fixtures";
import { evaluate } from "@/core/evaluate";
import { reconcile } from "@/core/reconcile";

export type CohortMeta = {
  total: number;
  taxonomyTotal: number;
  novelPatternRows: number;
  expectedClosed: number;
  hardExceptions: number;
  conservativeAbstentions: number;
  novelPatternSafeAbstentions: number;
  novelPatternFalseClosures: number;
};

function loadMeta(): CohortMeta {
  const metricsPath = join(process.cwd(), "docs/metrics.json");
  if (existsSync(metricsPath)) {
    try {
      const m = JSON.parse(readFileSync(metricsPath, "utf-8"));
      return {
        total: m.total ?? 122,
        taxonomyTotal: m.taxonomyTotal ?? 120,
        novelPatternRows: m.novelPatternRows ?? 2,
        expectedClosed: m.expectedClosed ?? 97,
        hardExceptions: m.hardExceptions ?? 20,
        conservativeAbstentions: m.conservativeAbstentions ?? 3,
        novelPatternSafeAbstentions: m.novelPatternSafeAbstentions ?? 2,
        novelPatternFalseClosures: m.novelPatternFalseClosures ?? 0,
      };
    } catch {
      // fall through to dynamic
    }
  }
  // Serverless fallback: compute from fixtures in-memory
  const fixture = generateBenchmarkCohort(20260904);
  const run = reconcile(fixture.settlementRows, fixture.ledgerRows, fixture.bankCredits);
  const ev = evaluate(run.results, fixture.truthRows);
  return {
    total: ev.total,
    taxonomyTotal: ev.taxonomyTotal,
    novelPatternRows: ev.novelPatternRows,
    expectedClosed: ev.expectedClosed,
    hardExceptions: ev.hardExceptions,
    conservativeAbstentions: ev.conservativeAbstentions,
    novelPatternSafeAbstentions: ev.novelPatternSafeAbstentions,
    novelPatternFalseClosures: ev.novelPatternFalseClosures,
  };
}

export async function GET() {
  try {
    const meta = loadMeta();
    return NextResponse.json(meta);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
