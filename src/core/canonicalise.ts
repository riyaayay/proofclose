/**
 * canonicalise.ts
 *
 * Maps raw Razorpay settlement-recon API response fields to the canonical
 * SettlementRow type. The adapter boundary is the only place where external
 * field names appear; the evidence engine always consumes canonical types.
 *
 * NOTE: This mapper is built from observed test-mode response shapes.
 * The Razorpay API field names are documented at:
 * https://razorpay.com/docs/api/settlements/fetch-recon/
 */

import type { EntityType, SettlementRow } from "./types";

// Razorpay test-mode recon combined item shape (observed fields)
type RazorpayReconItem = {
  settlement_id?: string;
  entity_type?: string;
  entity_id?: string;
  created_at?: number; // Unix epoch seconds
  settled_at?: number; // Unix epoch seconds
  amount?: number;     // paise
  fee?: number;        // paise
  tax?: number;        // paise
  credit?: number;     // paise (net)
  source?: string;
};

const ENTITY_TYPE_MAP: Record<string, EntityType> = {
  payment: "payment",
  refund: "refund",
  transfer: "transfer",
  adjustment: "adjustment",
};

function toIso(epochSeconds: number | undefined): string {
  if (!epochSeconds) return new Date(0).toISOString();
  return new Date(epochSeconds * 1000).toISOString();
}

export function mapRazorpayReconToSettlementRow(
  item: RazorpayReconItem,
  rawSourceId: string,
): SettlementRow {
  const entityType = ENTITY_TYPE_MAP[item.entity_type ?? ""] ?? "payment";
  return {
    settlementId: item.settlement_id ?? "",
    entityType,
    entityId: item.entity_id ?? "",
    createdAt: toIso(item.created_at),
    settledAt: toIso(item.settled_at),
    grossPaise: item.amount ?? 0,
    feePaise: item.fee ?? 0,
    taxPaise: item.tax ?? 0,
    netPaise: item.credit ?? 0,
    referenceId: item.source ?? undefined,
    rawSourceId,
  };
}
