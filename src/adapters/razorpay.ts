import Razorpay from "razorpay";

export function razorpayClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Missing Razorpay test credentials");
  }
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}

export async function fetchSettlementRecon(year: number, month: number, day: number) {
  const response = await fetch(
    `https://api.razorpay.com/v1/settlements/recon/combined?year=${year}&month=${String(month).padStart(2, "0")}&day=${String(day).padStart(2, "0")}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      },
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(`Razorpay recon fetch failed: ${response.status} ${await response.text()}`);
  return response.json();
}

export async function fetchOrdersCount(): Promise<number> {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return 0;
  try {
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders?count=20", {
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count ?? data.items?.length ?? 0;
  } catch {
    return 0;
  }
}
