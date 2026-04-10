
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import {
  getAuthorizedReportViewerContext,
  ReportViewerAccessError,
} from "@/lib/report-viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReportViewerPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function ReportViewerPage({
  params,
}: ReportViewerPageProps) {
  const { reportId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(`/report/${reportId}/view`)}`);
  }

  try {
    const viewer = await getAuthorizedReportViewerContext(reportId, userId);

    return (
      <main className="report-page app-page min-h-[calc(100vh-72px)] px-4 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
          <div className="app-surface flex flex-wrap items-start justify-between gap-4 rounded-3xl p-5">
            <div className="space-y-2">
              <Link
                href={`/report/${reportId}`}
                className="app-link inline-flex items-center gap-2 text-sm font-medium"
              >
                ← Back to report details
              </Link>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
                  View-only inspection report
                </h1>
                <p className="app-muted mt-1 text-sm">
                  {viewer.reportTitle} · {viewer.propertyAddress}
                </p>
              </div>
            </div>

          </div>

          <div className="app-surface rounded-3xl p-4">
            <div className="app-divider mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div>
                <p className="app-subtle text-sm font-semibold uppercase tracking-[0.18em]">
                  Pages
                </p>
                <p className="mt-1 text-sm text-[var(--text)]">
                  {viewer.totalPages} page{viewer.totalPages === 1 ? "" : "s"}
                </p>
              </div>

              <div className="app-muted text-sm">
                Viewer-only access is tied to your account.
              </div>
            </div>

            <div className="space-y-6">
              {Array.from({ length: viewer.totalPages }, (_, index) => {
                const pageNumber = index + 1;

                return (
                  <section key={pageNumber} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--text)]">
                        Page {pageNumber}
                      </span>
                    </div>

                    <div className="app-surface-subtle overflow-hidden rounded-2xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/reports/${reportId}/pages/${pageNumber}`}
                        alt={`Inspection report page ${pageNumber}`}
                        className="block h-auto w-full select-none"
                        draggable={false}
                        loading={pageNumber <= 2 ? "eager" : "lazy"}
                      />
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof ReportViewerAccessError) {
      if (error.code === "NOT_FOUND") {
        notFound();
      }

      if (error.code === "FORBIDDEN") {
        redirect(`/report/${reportId}`);
      }
    }

    throw error;
  }
}
