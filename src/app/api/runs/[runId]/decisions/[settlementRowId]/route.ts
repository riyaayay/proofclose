import { NextResponse } from "next/server";
import { z } from "zod";
import { markDecisionReviewed } from "@/core/audit";

export const runtime = "nodejs";

const bodySchema = z.object({
  reviewerId: z.string().min(1).max(80),
  status: z.enum(["REVIEWED", "ESCALATED"]),
  actionCategory: z.enum([
    "flag_for_followup",
    "reissue_recon_t2",
    "escalate_finance_lead",
    "insufficient_information",
  ]).default("flag_for_followup"),
  reason: z.string().min(3).max(500),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ runId: string; settlementRowId: string }> },
) {
  const body = bodySchema.parse(await request.json());
  const { runId, settlementRowId } = await params;
  await markDecisionReviewed({
    runId,
    settlementRowId,
    ...body,
    reviewedAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}
