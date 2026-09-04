/**
 * scripts/seed-razorpay-test-data.ts
 *
 * Seeds test-mode transactions in Razorpay using the official API:
 * 1. Creates test orders across realistic amounts (paise integers)
 * 2. Checks existing test-mode settlements via GET /v1/settlements
 * 3. Attempts to trigger on-demand settlement simulation if supported
 * 4. Checks the settlement reconciliation combined endpoint
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-razorpay-test-data.ts
 */

import Razorpay from "razorpay";
import { fetchSettlementRecon } from "../src/adapters/razorpay";

async function main() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    console.error("Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in environment.");
    process.exit(1);
  }

  console.log(`Connecting to Razorpay Test Mode with Key ID: ${key_id.slice(0, 10)}...`);
  const rzp = new Razorpay({ key_id, key_secret });

  // 1. Create a series of test orders
  const testAmounts = [25000, 75000, 149900, 50000]; // in paise
  const orders = [];

  for (let i = 0; i < testAmounts.length; i++) {
    const amount = testAmounts[i];
    try {
      const order = await rzp.orders.create({
        amount,
        currency: "INR",
        receipt: `rcpt_test_${Date.now()}_${i + 1}`,
        notes: {
          test_run: "proofclose_seed",
          created_by: "ProofClose Controller",
        },
      });
      orders.push(order);
      console.log(`✓ Created test order: ${order.id} for ₹${amount / 100} (${amount} paise)`);
    } catch (err: any) {
      console.warn(`Order creation error for ₹${amount / 100}:`, err?.message ?? err);
    }
  }

  // 2. Query test settlements list
  try {
    const authHeader = `Basic ${Buffer.from(`${key_id}:${key_secret}`).toString("base64")}`;
    const settlementsRes = await fetch("https://api.razorpay.com/v1/settlements?count=10", {
      headers: { Authorization: authHeader },
    });
    if (settlementsRes.ok) {
      const settlementsData = await settlementsRes.json();
      console.log(`Existing settlements found: ${settlementsData.count ?? 0}`);
      if (settlementsData.items?.length > 0) {
        console.log("Sample settlement:", JSON.stringify(settlementsData.items[0], null, 2));
      }
    } else {
      console.log(`GET /v1/settlements returned status: ${settlementsRes.status}`);
    }
  } catch (err: any) {
    console.log("Settlements list query note:", err?.message ?? err);
  }

  // 3. Attempt On-Demand / Instant settlement trigger
  try {
    const authHeader = `Basic ${Buffer.from(`${key_id}:${key_secret}`).toString("base64")}`;
    const ondemandRes = await fetch("https://api.razorpay.com/v1/settlements/ondemand", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        settle_full_balance: true,
        notes: { reason: "proofclose_test_simulation" },
      }),
    });
    const ondemandData = await ondemandRes.json();
    console.log("On-demand settlement API response:", ondemandRes.status, ondemandData);
  } catch (err: any) {
    console.log("On-demand settlement not enabled on account (expected for standard test mode):", err?.message ?? err);
  }

  // 4. Query settlement recon combined endpoint for current date
  const now = new Date();
  console.log(`Querying GET /v1/settlements/recon/combined for ${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}...`);
  try {
    const recon = await fetchSettlementRecon(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      now.getUTCDate()
    );
    console.log("Reconciliation endpoint result:", JSON.stringify(recon, null, 2));
  } catch (err: any) {
    console.log("Reconciliation endpoint note:", err?.message ?? err);
  }
}

main().catch(console.error);
