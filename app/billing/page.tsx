"use client";

import Link from "next/link";
import { useState } from "react";

type BillingInterval = "monthly" | "annual";

export default function BillingPage() {
  const [submitting, setSubmitting] = useState<BillingInterval | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubscribe(interval: BillingInterval) {
    setSubmitting(interval);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ interval }),
      });

      const json = (await response.json()) as
        | { checkoutUrl: string }
        | { error?: string };

      if (!response.ok || !("checkoutUrl" in json) || !json.checkoutUrl) {
        throw new Error(
          "error" in json && typeof json.error === "string"
            ? json.error
            : "Failed to start subscription checkout",
        );
      }

      window.location.href = json.checkoutUrl;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to start subscription checkout",
      );
      setSubmitting(null);
    }
  }

  return (
    <main className="app-page min-h-[calc(100vh-72px)] px-4 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <p className="app-subtle text-sm font-semibold uppercase tracking-[0.18em]">
              Seller billing
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">
              Compare Seller Subscription Plans
            </h1>
            <p className="app-muted max-w-3xl text-sm sm:text-base">
              Choose the plan that fits how often you want to list inspection
              reports. Monthly keeps your upfront cost lower. Annual gives you
              the better rate if you plan to stay active. Every time one of
              your posted inspection reports sells, you earn <strong>$40</strong>.
              The more reports you post, the more earning potential you have.
            </p>
          </div>

          <Link
            href="/dashboard/reports"
            className="app-link text-sm font-medium"
          >
            Back to dashboard
          </Link>
        </div>

        {errorMessage ? (
          <div className="alert-danger rounded-2xl px-4 py-3 text-sm">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="app-surface rounded-3xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="app-subtle text-sm font-semibold uppercase tracking-[0.18em]">
                  Monthly
                </p>
                <h2 className="mt-2 text-3xl font-bold text-[var(--text)]">
                  $19.99
                  <span className="app-subtle ml-2 text-base font-medium">
                    / month
                  </span>
                </h2>
              </div>
            </div>

            <div className="app-surface-subtle mt-6 rounded-2xl p-4">
              <p className="text-sm font-medium text-[var(--text)]">
                Best for flexibility
              </p>
              <p className="app-muted mt-1 text-sm">
                A straightforward monthly subscription for sellers who want to
                get started without a larger upfront payment.
              </p>
            </div>

            <ul className="mt-6 space-y-3 text-sm text-[var(--text)]">
              <li>List and manage inspection reports</li>
              <li>Upload PDF report files</li>
              <li>Maintain active marketplace listings</li>
              <li>Earn <strong>$40 per report sold</strong></li>
              <li>Cancel when you no longer need it</li>
            </ul>

            <button
              type="button"
              onClick={() => void handleSubscribe("monthly")}
              disabled={submitting !== null}
              className="app-button-primary mt-8 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting === "monthly" ? "Redirecting..." : "Choose Monthly"}
            </button>
          </article>

          <article className="app-surface rounded-3xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                  Annual
                </p>
                <h2 className="mt-2 text-3xl font-bold text-[var(--text)]">
                  $179.88
                  <span className="app-subtle ml-2 text-base font-medium">
                    / year
                  </span>
                </h2>
              </div>

              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                Best value
              </span>
            </div>

            <div className="app-surface-subtle mt-6 rounded-2xl p-4">
              <p className="text-sm font-medium text-[var(--text)]">
                Lower effective monthly cost
              </p>
              <p className="app-muted mt-1 text-sm">
                Equivalent to <strong>$14.99/month</strong> billed annually.
                Save <strong>$60.00</strong> compared with paying monthly for a
                full year.
              </p>
            </div>

            <ul className="mt-6 space-y-3 text-sm text-[var(--text)]">
              <li>Everything in the monthly plan</li>
              <li>Lower effective monthly price</li>
              <li>Great for active inspectors and steady inventory</li>
              <li>Earn <strong>$40 per report sold</strong></li>
              <li>Better long-term value for repeat sellers</li>
            </ul>

            <button
              type="button"
              onClick={() => void handleSubscribe("annual")}
              disabled={submitting !== null}
              className="app-button-primary mt-8 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting === "annual" ? "Redirecting..." : "Choose Annual"}
            </button>
          </article>
        </section>

        <section className="app-surface rounded-3xl p-6">
          <h2 className="text-xl font-semibold text-[var(--text)]">
            Earning potential
          </h2>
          <p className="app-muted mt-3 text-sm sm:text-base">
            Subscribing lets you post reports for sale in the marketplace. When one
            of your inspection reports sells, you earn <strong>$40</strong> from that
            sale. Posting more high-quality reports creates more chances to earn.
          </p>
        </section>

        <section className="app-surface rounded-3xl p-6">
          <h2 className="text-xl font-semibold text-[var(--text)]">
            What this subscription unlocks
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="app-surface-subtle rounded-2xl p-4">
              <p className="font-medium text-[var(--text)]">
                Create report listings
              </p>
              <p className="app-muted mt-1 text-sm">
                Add new home inspection reports to the marketplace from your dashboard.
              </p>
            </div>

            <div className="app-surface-subtle rounded-2xl p-4">
              <p className="font-medium text-[var(--text)]">
                Upload and manage files
              </p>
              <p className="app-muted mt-1 text-sm">
                Attach inspection PDFs and maintain active listings buyers can purchase.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
