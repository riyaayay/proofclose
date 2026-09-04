import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofClose — Razorpay Settlement Controller",
  description:
    "Deterministic settlement-to-ledger-to-bank reconciliation controller. Closes records only when exact evidence exists; creates typed exception queue for everything else.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
