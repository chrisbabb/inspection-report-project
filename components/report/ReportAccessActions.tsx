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
        <div className="alert-success rounded-2xl px-4 py-3 text-sm">
          Purchase successful. You can now view this report.
        </div>
      ) : null}

      {purchaseCancelled ? (
        <div className="alert-warning rounded-2xl px-4 py-3 text-sm">
          Checkout was cancelled.
        </div>
      ) : null}

      {hasAccess ? (
        <Link
          href={`/report/${reportId}/view`}
          className="app-button-emerald w-full px-5 py-3 text-sm"
        >
          {isOwnerOrAdmin ? "View Report" : "View Purchased Report"}
        </Link>
      ) : (
        <PurchaseReportButton reportId={reportId} buttonLabel={`Purchase Report (${priceLabel})`} />
      )}
    </div>
  );
}
