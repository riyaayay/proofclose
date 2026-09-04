import { fetchSettlementRecon } from "../src/adapters/razorpay";
const now = new Date();
fetchSettlementRecon(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())
  .then(x => console.log(JSON.stringify({ entity: x.entity, count: x.count }, null, 2)))
  .catch(err => { console.error(err); process.exitCode = 1; });
