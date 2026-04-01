"use client";

import { useState } from "react";

type PurchaseReportButtonProps = {
  reportId: string;
  buttonLabel?: string;
};

type PurchaseResponse = {
  checkoutUrl?: string;
  error?: string;
};

export default function PurchaseReportButton({
  reportId,
  buttonLabel = "Purchase Report ($50)",
}: PurchaseReportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/reports/${reportId}/purchase`, {
        method: "POST",
      });

      const data = (await res.json()) as PurchaseResponse;

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start checkout");
      }

      if (!data.checkoutUrl) {
        throw new Error("Stripe checkout URL was not returned");
      }

      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to start checkout",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className="inline-flex w-full items-center justify-center rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Redirecting to checkout…" : buttonLabel}
      </button>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}
    </div>
  );
}