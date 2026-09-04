import { describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { saveRun, markDecisionReviewed, getRun } from "@/core/audit";
import { reconcile } from "@/core/reconcile";

describe("reviewer action audit persistence", () => {
  it("records reviewer disposition and audit history without altering engine decision", async () => {
    const run = reconcile(
      [{ settlementId: "s1", entityType: "payment", entityId: "pay_test", createdAt: "2026-09-01T00:00:00Z", settledAt: "2026-09-02T00:00:00Z", grossPaise: 10000, feePaise: 200, taxPaise: 36, netPaise: 9764, rawSourceId: "rp-test-1" }],
      [],
      [],
    );
    expect(run.results[0].decision).toBe("EXCEPTION");

    await saveRun(run);

    await markDecisionReviewed({
      runId: run.runId,
      settlementRowId: "rp-test-1",
      reviewerId: "lead.auditor@merchant.com",
      status: "REVIEWED",
      actionCategory: "flag_for_followup",
      reason: "Verified ledger entry was created post-batch in ERP.",
      reviewedAt: new Date().toISOString(),
    });

    const loaded = await getRun(run.runId);
    expect(loaded).not.toBeNull();
    const row = loaded!.results.find(r => r.settlementRowId === "rp-test-1");
    expect(row).toBeDefined();

    // The engine decision remains immutably EXCEPTION
    expect(row!.decision).toBe("EXCEPTION");
    expect(row!.exceptionCode).toBe("MISSING_LEDGER_RECORD");

    // Reviewer disposition is cleanly stored
    expect(row!.reviewStatus).toBe("REVIEWED");
    expect(row!.reviewerId).toBe("lead.auditor@merchant.com");
    expect(row!.reviewReason).toBe("Verified ledger entry was created post-batch in ERP.");

    // Check that reviewer_action_audit table logged the event
    const db = getDb();
    const auditRecord = db.prepare(
      "SELECT * FROM reviewer_action_audit WHERE run_id = ? AND settlement_row_id = ?"
    ).get(run.runId, "rp-test-1") as { reviewer_id: string; action_category: string; status: string } | undefined;

    expect(auditRecord).toBeDefined();
    expect(auditRecord!.reviewer_id).toBe("lead.auditor@merchant.com");
    expect(auditRecord!.action_category).toBe("flag_for_followup");
    expect(auditRecord!.status).toBe("REVIEWED");
  });
});
