"use client";

import { useState } from "react";

type PublicReportDetail = {
  id: string;
  title: string | null;
  summary: string | null;
  inspectionDate: string;
  status: "PUBLISHED";
  createdAt: string;
  property: {
    id: string;
    formattedAddress: string;
    city: string;
    state: string;
    zip: string;
  };
  files: Array<{
    id: string;
    kind: "PDF" | "IMAGE";
    originalFilename: string;
    mimeType: string;
  }>;
};

type Props = {
  report: PublicReportDetail;
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

export default function PublicReportDetailClient({ report }: Props) {
  const [loadingPurchase, setLoadingPurchase] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handlePurchase() {
    setLoadingPurchase(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/reports/${report.id}/purchase`, {
        method: "POST",
      });

      const json: ApiResponse<{ message: string }> = await response.json();

      if (!json.ok) {
        throw new Error(json.error.message);
      }

      setMessage(json.data.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to start purchase",
      );
    } finally {
      setLoadingPurchase(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <div className="border-b pb-6">
          <h1 className="text-3xl font-semibold">
            {report.title || "Home Inspection Report"}
          </h1>
          <p className="mt-2 text-gray-600">{report.property.formattedAddress}</p>
          <p className="mt-1 text-sm text-gray-500">
            Inspection date: {new Date(report.inspectionDate).toLocaleDateString()}
          </p>
        </div>

        <div className="mt-6 grid gap-8 md:grid-cols-[1fr_280px]">
          <div className="space-y-6">
            <section>
              <h2 className="text-lg font-semibold">Report Summary</h2>
              <p className="mt-2 text-gray-600">
                {report.summary ||
                  "This report is available for purchase. Purchase access to view the full inspection document."}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Included Files</h2>
              <ul className="mt-3 space-y-2">
                {report.files.map((file) => (
                  <li
                    key={file.id}
                    className="rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-600"
                  >
                    {file.originalFilename} · {file.kind}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-medium text-amber-900">Full Report Locked</h3>
              <p className="mt-1 text-sm text-amber-800">
                Purchase access to view the full report document. Report downloads
                are not included.
              </p>
            </section>
          </div>

          <aside className="rounded-2xl border bg-gray-50 p-5">
            <h2 className="text-lg font-semibold">Purchase Access</h2>
            <p className="mt-2 text-3xl font-semibold">$50</p>
            <p className="mt-2 text-sm text-gray-600">
              One-time access to view this inspection report.
            </p>

            <button
              type="button"
              onClick={() => void handlePurchase()}
              disabled={loadingPurchase}
              className="mt-6 w-full rounded-lg bg-black px-4 py-3 text-white disabled:opacity-50"
            >
              {loadingPurchase ? "Starting..." : "Buy Report"}
            </button>

            {message ? (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {message}
              </div>
            ) : null}

            {errorMessage ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}