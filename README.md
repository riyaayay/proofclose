# ProofClose

One-sentence controller loop: `settlement row → merchant ledger → bank deposit → close or exception`.

[![CI](https://github.com/riyaayay/proofclose/actions/workflows/test.yml/badge.svg)](https://github.com/riyaayay/proofclose/actions/workflows/test.yml)

**Live URL:** [proofclose.vercel.app](https://proofclose.vercel.app/)

---

## Why this matters

Settlement-to-ledger-to-bank reconciliation is a **verification problem**, not a summarisation problem.
A summary reports a payout. ProofClose **proves or refuses to prove** the relationship between each settlement 
component, merchant record and bank credit — with a typed audit trail. A no-close result is a valid, 
honest controller outcome.

---

## What is real and what is synthetic

| Component | Scope and status |
|---|---|
| Next.js web application & SQLite audit store | **Real** — local full-stack controller with reviewer disposition audit log |
| Deterministic evidence engine | **Real** — integer-paise arithmetic, zero fuzzy matching, typed exception taxonomy |
| Razorpay Test Mode adapter | **Real** — authenticated, read-only `GET /v1/settlements/recon/combined` client & schema validator |
| 122-record evaluation cohort | **Synthetic** — seeded (20260904), committed, independently sampled entity types & scenarios |
| Reported controller metrics | **Synthetic cohort only** — the reported accuracy and recall metrics run against the synthetic 120-record cohort because it possesses a known, verified ground-truth answer key. Live test-mode reconciliation can also be initiated via `POST /api/reconcile?source=razorpay`. |

---

## Run locally

```bash
# 1. Clone and install
git clone <repo-url>
cd proofclose
npm install

# 2. Create .env.local (never commit this file)
cp .env.example .env.local
# Fill in RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET with test-mode keys

# 3. Generate the synthetic fixture
npm run generate:data

# 4. Run tests
npm test

# 5. Validate metrics (must produce exactly 97 closed, 23 exceptions, 0 false closures)
npm run evaluate

# 6. Start the dashboard
npm run dev
# Open http://localhost:3000
```

---

## Metrics (synthetic cohort, seed 20260904, 122 rows)

> Snapshot from a run on 2026-09-05 — reproducible via `npm run evaluate`; see `docs/metrics.json` for the full committed output.
>
> **Note on sample size:** With ~3 samples per exception category, per-category precision/recall are indicative of algorithmic behaviour, not statistically robust estimates. A production validation set would need materially more samples per category. See `docs/METRICS.md` for the full statistical-limits disclosure.

Metrics are computed by `npm run evaluate` and written to `docs/metrics.json`.

| Metric | Value | Formula | Notes |
|---|---|---|---|
| Auto-Close Match Rate | **80.8%** | `correct_closed / taxonomy_total` | 97/120 overall throughput |
| Close Precision | **100%** | `correct_closed / predicted_closed` | Zero false closures |
| Close Recall (strict) | **100%** | `correct_closed / expected_closed` | All expected closures executed |
| Closeability Recall | **97%** | `correct_closed / financial_closeable` | 3 conservative abstentions on narration |
| Hard-Exception Recall | **100%** | `correct_hard_exceptions / hard_exceptions` | All 20 genuine exceptions caught |
| Financial-State Accuracy | **97.5%** | `(correct_closed + correct_hard_exc) / taxonomy_total` | Combined accuracy |
| Conservative Abstentions | **3** | count | Rows refused for safety (narration unverifiable) |
| **False Closures** | **0** | `predicted_closed − correct_closed` | **Must be 0 — enforced by CI** |
| Novel-Pattern Safe Abstentions | **2/2** | novel rows → EXCEPTION | Both out-of-taxonomy rows correctly abstained |


> **Close Recall vs Closeability Recall:** The three `UNVERIFIED_BANK_NARRATION` rows are _financially_ closeable
> in the data-generating world, but the controller deliberately abstains because bank narration alone is not
> sufficient proof. This produces `closeabilityRecall < closeRecall`. Both numbers are reported and labelled
> separately. Conservative abstentions are a safety feature, not errors.

See `docs/METRICS.md` for confusion matrix definitions and the full sample-size disclosure.

---

## Exception taxonomy

| Code | Cause |
|---|---|
| `MISSING_LEDGER_RECORD` | No merchant ledger row matches the entity ID |
| `AMOUNT_DELTA` | Paise field mismatch — even 1 paise triggers exception |
| `DUPLICATE_LEDGER_CANDIDATE` | Two ledger rows claim the same Razorpay entity ID |
| `MISSING_BANK_CREDIT` | No bank credit equals the settlement control total |
| `AMBIGUOUS_BANK_CREDIT` | Two bank credits share the same control total — unsafe to choose |
| `UNVERIFIED_BANK_NARRATION` | Amount matches but narration cannot prove Razorpay as payer |
| `UNKNOWN_ADJUSTMENT` | Adjustment reason not on the approved allowlist |

---

## Architecture and auditability

- All money is stored and compared as **integer paise** — no floating-point arithmetic.
- Every run gets an immutable run ID and an input SHA-256 hash.
- Every rule that fires is recorded with source IDs and facts.
- Reviewer dispositions (REVIEWED / ESCALATED) are stored separately from engine decisions — a review can never change `CLOSED` or `EXCEPTION`.
- No LLM participates in any financial decision.

See `docs/ARCHITECTURE.md`.

---

## Deliberate failure case

Settlement `setl_40` has two Razorpay bank credits with the exact same control total. The engine produces `AMBIGUOUS_BANK_CREDIT` for all three dependent rows and refuses to close any of them.

> "A normal dashboard might call this reconciled because the number matches. We intentionally do not. The cost of a false close is a misstated cash position, so this record stays in review."

See `docs/FAILURE_CASE.md`.

---

## Deployment

Deploy to Vercel. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `DATABASE_PATH` as environment variables. **Never commit `.env.local` or any live-mode credential to the repository.**
