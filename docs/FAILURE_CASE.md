# Deliberate Failure Case — AMBIGUOUS_BANK_CREDIT

## Data

Settlement `setl_40` consists of three rows (rows 118–120 in the cohort). The computed control total (sum of netPaise for those three rows) has a specific value. The synthetic bank credit file contains **two** credit rows for this exact amount — both bearing valid Razorpay narrations and appearing within the settlement date window.

## Expected behaviour

ProofClose creates **no ledger close** for any of the three settlement rows. Instead, it creates one `AMBIGUOUS_BANK_CREDIT` exception per row. Each exception:

1. Names both candidate bank transaction IDs (`bank-setl_40-a` and `bank-setl_40-b`).
2. Reports `candidateCount: 2` in the evidence facts.
3. Explicitly refuses to choose between the two candidates.

## Why the engine does not choose

Amount-only matching is a **false-close risk**. If two bank transfers arrive for the same amount from Razorpay on the same date — which can happen if two settlements are for the same total — picking the first arbitrarily would:

- Potentially mis-assign a credit to the wrong settlement batch.
- Leave one of the two bank credits unmatched and invisible in the exception queue.
- Produce a misstated cash position in the merchant's books.

## Financial principle

A standard dashboard might call this reconciled merely because the amounts match. ProofClose intentionally does not. Matching on amount alone carries high risk of misallocating funds and misstating the cash position. The record safely remains in the finance review queue until a reviewer identifies the correct transaction.

## Safe resolution path

A finance reviewer must:

1. Open the run detail for `setl_40`.
2. Compare the UTR numbers of the two bank credits against Razorpay's payout advice or the bank reference.
3. Select the correct credit and post the closure manually.
4. Mark the settlement row as `REVIEWED` in the audit store with a reason referencing the UTR.

## Where to find this in the UI

Run reconciliation → filter by `EXCEPTION` → look for rows with exception code `AMBIGUOUS_BANK_CREDIT` → click any row → Evidence Drawer shows both candidate bank transaction IDs.
