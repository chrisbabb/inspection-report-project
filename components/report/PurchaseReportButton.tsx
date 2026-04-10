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
      setError(err instanceof Error ? err.message : "Unable to start checkout");
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
        className="app-button-primary w-full px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Redirecting to checkout…" : buttonLabel}
      </button>

      {error ? <div className="alert-danger rounded-2xl px-4 py-3 text-sm">{error}</div> : null}
    </div>
  );
}
