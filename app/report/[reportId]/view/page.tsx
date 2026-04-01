"use client";

import { useEffect, useState } from "react";

type ViewUrlResponse = {
  url?: string;
  mimeType?: string;
  filename?: string;
  kind?: string;
  error?: string;
};

type ReportViewerPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default function ReportViewerPage({
  params,
}: ReportViewerPageProps) {
  const [reportId, setReportId] = useState<string>("");
  const [data, setData] = useState<ViewUrlResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const resolvedParams = await params;
        if (cancelled) return;

        setReportId(resolvedParams.reportId);

        const res = await fetch(
          `/api/reports/${resolvedParams.reportId}/view-url`,
          {
            cache: "no-store",
          },
        );

        const json = (await res.json()) as ViewUrlResponse;

        if (!cancelled) {
          setData(json);
        }
      } catch {
        if (!cancelled) {
          setData({
            error: "Failed to load report viewer",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [params]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-6 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            Loading report…
          </div>
        </div>
      </main>
    );
  }

  if (!data?.url) {
    return (
      <main className="min-h-screen bg-white px-6 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
            {data?.error ?? "Unable to load this report."}
          </div>

          {reportId ? (
            <div className="mt-4">
              <a
                href={`/report/${reportId}`}
                className="inline-flex rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
              >
                Back to report details
              </a>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  const isPdf =
    data.mimeType === "application/pdf" ||
    data.filename?.toLowerCase().endsWith(".pdf");

  const isImage = Boolean(data.mimeType?.startsWith("image/"));

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Inspection Report Viewer</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Secure view-only access
            </p>
          </div>

          {reportId ? (
            <a
              href={`/report/${reportId}`}
              className="inline-flex rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Back to report details
            </a>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {isPdf ? (
            <iframe
              src={data.url}
              title="Inspection Report PDF"
              className="h-[calc(100vh-120px)] w-full"
            />
          ) : isImage ? (
            <div className="flex min-h-[calc(100vh-120px)] items-center justify-center bg-slate-100 p-6 dark:bg-slate-950">
              <img
                src={data.url}
                alt="Inspection report"
                className="max-h-[calc(100vh-180px)] max-w-full rounded-2xl shadow"
              />
            </div>
          ) : (
            <div className="p-8">
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                This file type cannot be embedded directly.
              </p>
              <a
                href={data.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Open report file
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}