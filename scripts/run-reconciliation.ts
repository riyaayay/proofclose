import { loadFixtureInputs, saveRun } from "../src/core/audit";
import { reconcile } from "../src/core/reconcile";

const input = await loadFixtureInputs();
const run = reconcile(input.settlementRows, input.ledgerRows, input.bankCredits);
await saveRun(run);

const closed = run.results.filter(r => r.decision === "CLOSED").length;
const exceptions = run.results.filter(r => r.decision === "EXCEPTION").length;
console.log(`Run ID: ${run.runId}`);
console.log(`Input SHA-256: ${run.inputSha256}`);
console.log(`Algorithm: ${run.algorithmVersion}`);
console.log(`Total: ${run.results.length} | Closed: ${closed} | Exceptions: ${exceptions}`);
console.log(`Duration: ${new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()}ms`);
