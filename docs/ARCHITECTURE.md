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
