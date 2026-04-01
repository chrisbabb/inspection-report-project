"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PurchaseReportButton from "@/components/report/PurchaseReportButton";

type ReportAccessActionsProps = {
  reportId: string;
  hasAccess: boolean;
  isOwnerOrAdmin?: boolean;
  priceLabel?: string;
};

export default function ReportAccessActions({
  reportId,
  hasAccess,
  isOwnerOrAdmin = false,
  priceLabel = "$50",
}: ReportAccessActionsProps) {
  const searchParams = useSearchParams();

  const purchaseSuccess = searchParams.get("purchase") === "success";
  const purchaseCancelled = searchParams.get("purchase") === "cancelled";

  return (
    <div className="space-y-4">
      {purchaseSuccess ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
          Purchase successful. You can now view this report.
        </div>
      ) : null}

      {purchaseCancelled ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300">
          Checkout was cancelled.
        </div>
      ) : null}

      {hasAccess ? (
        <Link
          href={`/report/${reportId}/view`}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          {isOwnerOrAdmin ? "View Report" : "View Purchased Report"}
        </Link>
      ) : (
        <PurchaseReportButton
          reportId={reportId}
          buttonLabel={`Purchase Report (${priceLabel})`}
        />
      )}
    </div>
  );
}