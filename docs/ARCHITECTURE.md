# Architecture

## Data flow

```
Razorpay settlement recon (test API / CSV) ─┐
Merchant order & refund ledger (CSV) ───────┼─> canonicalise + SHA-256 hash
Bank statement credits (CSV) ───────────────┘                 │
                                                              v
                                                    deterministic evidence engine
                                                    ├─ entity exact-match rules
                                                    ├─ settlement control totals
                                                    ├─ bank-credit proof rules
                                                    └─ exception taxonomy
                                                              │
                                                              ├─ SQLite audit store
                                                              ├─ metrics evaluator vs. committed truth labels
                                                              └─ Next.js dashboard
                                                                       │
                                    optional, display-only LLM summary ┘
```

## Money handling

All amounts are stored and compared as **integer paise** (1 INR = 100 paise). The `decimal.js` library is used at the adapter boundary to safely convert INR decimal values to paise. No floating-point arithmetic is used inside the evidence engine.

## Deterministic engine (`src/core/reconcile.ts`)

For each settlement row, the engine checks in order:

1. Exactly one ledger row matches the entity ID (`MISSING_LEDGER_RECORD` or `DUPLICATE_LEDGER_CANDIDATE`)
2. All four paise fields match exactly (`AMOUNT_DELTA`)
3. For adjustments: reason is on the allowlist (`UNKNOWN_ADJUSTMENT`)
4. Exactly one bank credit matches the settlement control total (`MISSING_BANK_CREDIT` or `AMBIGUOUS_BANK_CREDIT`)
5. Bank narration contains RAZORPAY or RZP (`UNVERIFIED_BANK_NARRATION`)
6. All checks pass → `CLOSED`

No step uses a similarity score. Each check is boolean.

## Audit store (`src/db/`)

SQLite with WAL mode. Every run persists:
- Run ID (nanoid), algorithm version, input SHA-256, start/finish timestamps
- Per-row: settlement row ID, decision, exception code, ledger ID, bank txn ID, full evidence JSON
- Reviewer disposition: status (UNREVIEWED / REVIEWED / ESCALATED), reviewer ID, reason, timestamp

Reviewer disposition columns are separate from engine decision columns. A PATCH to the reviewer endpoint can update disposition but **cannot** change `decision` or `exception_code`.

## Razorpay adapter (`src/adapters/razorpay.ts`)

Read-only. Uses `GET /v1/settlements/recon/combined`. Only called in:
- `scripts/smoke-razorpay.ts` (schema validation)
- Future source-preview feature

The benchmark engine always runs against the committed synthetic cohort — not live Razorpay data.

## Security boundaries

- `RAZORPAY_KEY_SECRET` is server-side only, in environment variables, never in client bundle.
- No write endpoint to Razorpay. No ability to move money, post refunds, or accept disputes.
- `.env.local` and `data/*.db` are in `.gitignore`.

---

## Explicitly out of scope for this cohort

The following discrepancy classes are not handled by the current engine. Each entry states why it is out of scope for this cohort and how the existing architecture would extend to support it.

| Edge case | Out-of-scope rationale | Extension path |
|---|---|---|
| **Multi-currency settlements** | All amounts in this cohort are INR paise; `SettlementRow` and `LedgerRow` have no currency-code field, so the engine cannot detect cross-currency mismatches explicitly (row 121 exercises the safe-fallthrough behaviour via AMOUNT_DELTA). | Add a `currencyCode` field to both types; the evidence engine's first check would assert `settlement.currencyCode === ledger.currencyCode`, emitting a new `CURRENCY_MISMATCH` exception code before any paise comparison runs. |
| **TDS / tax-threshold-triggered amount adjustments** | TDS deductions are a function of merchant PAN status, annual payout volume, and tax year — none of which are present in the synthetic cohort's data model. | Extend `LedgerRow` with `tdsDeductedPaise` and `tdsThresholdApplicable`; the amount-match rule would compute `expectedNet = grossPaise - feePaise - taxPaise - tdsDeductedPaise` before the equality check. |
| **Negative adjustments / clawbacks** | The cohort includes positive-amount adjustments only; negative adjustment rows would produce a negative `netPaise` on `SettlementRow`, which the current bank-credit match logic (comparing `creditPaise` to `expectedCredit`) would fail to find because bank debits and credits are in separate tables. | Add a `bankDebit` table alongside `BankCredit`; the control-total check would resolve the sign of `netPaise` and route to the appropriate table before amount comparison. |
| **Cross-settlement-cycle partial payouts** | Each settlement batch in this cohort settles exactly once — the control-total check assumes `one settlement batch → one bank credit`. A single order settling across two batches would split into two partial credits that each fail the exact-amount match. | Introduce a `partialSettlementGroup` field linking related batches; the bank-credit step would sum credits within a group before comparing to the order gross, and emit a new `PARTIAL_SETTLEMENT_SPLIT` code when grouping is required but group membership is ambiguous. |
