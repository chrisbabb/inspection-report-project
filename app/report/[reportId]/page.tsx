import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import ReportAccessActions from "@/components/report/ReportAccessActions";

type ReportDetailPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function getStatusBadgeClasses(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "PROCESSING":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300";
    case "DRAFT":
      return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
    case "REMOVED":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

export default async function ReportDetailPage({
  params,
}: ReportDetailPageProps) {
  const { reportId } = await params;
  const { userId: clerkUserId } = await auth();

  const report = await db.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      title: true,
      summary: true,
      status: true,
      extractionStatus: true,
      inspectionDate: true,
      priceCents: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      sellerUserId: true,
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      property: {
        select: {
          formattedAddress: true,
          street: true,
          city: true,
          state: true,
          zip: true,
          lat: true,
          lng: true,
        },
      },
      files: {
        orderBy: {
          sortOrder: "asc",
        },
        select: {
          id: true,
          kind: true,
          originalFilename: true,
          mimeType: true,
          sizeBytes: true,
          pageCount: true,
          createdAt: true,
        },
      },
    },
  });

  if (!report) {
    notFound();
  }

  if (report.status === "REMOVED") {
    notFound();
  }

  const user = clerkUserId
    ? await db.user.findUnique({
        where: { clerkUserId },
        select: {
          id: true,
          role: true,
        },
      })
    : null;

  const isSeller = user?.id === report.sellerUserId;
  const isAdmin = user?.role === "ADMIN";

  let hasPurchasedAccess = false;

  if (user && !isSeller && !isAdmin) {
    const access = await db.reportAccess.findUnique({
      where: {
        reportId_buyerUserId: {
          reportId: report.id,
          buyerUserId: user.id,
        },
      },
      select: {
        status: true,
      },
    });

    hasPurchasedAccess = access?.status === "ACTIVE";
  }

  const hasAccess = Boolean(isSeller || isAdmin || hasPurchasedAccess);
  const isPublished = report.status === "PUBLISHED";
  const isLoggedIn = Boolean(user);
  const canPurchase = isPublished && isLoggedIn && !hasAccess && !isSeller && !isAdmin;

  return (
    <main className="app-page min-h-screen">
      <div className="app-surface app-divider rounded-none border-x-0 border-t-0 shadow-none">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/"
                  className="app-link text-sm"
                >
                  ← Back to marketplace
                </Link>

                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadgeClasses(report.status)}`}
                >
                  {report.status}
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight">
                {report.title?.trim() || "Home Inspection Report"}
              </h1>

              <p className="app-muted text-sm">
                {report.property.formattedAddress}
              </p>
            </div>

            <div className="text-right">
              <div className="app-subtle text-sm">
                Report price
              </div>
              <div className="text-3xl font-bold">
                ${(report.priceCents / 100).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-6">
          <div className="app-surface rounded-3xl p-6">
            <h2 className="text-lg font-semibold">Property Details</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="app-surface-subtle rounded-2xl p-4">
                <div className="app-subtle text-xs font-semibold uppercase tracking-wide">
                  Address
                </div>
                <div className="mt-2 text-sm">
                  {report.property.street}
                  <br />
                  {report.property.city}, {report.property.state}{" "}
                  {report.property.zip}
                </div>
              </div>

              <div className="app-surface-subtle rounded-2xl p-4">
                <div className="app-subtle text-xs font-semibold uppercase tracking-wide">
                  Inspection Date
                </div>
                <div className="mt-2 text-sm">
                  {formatDate(report.inspectionDate)}
                </div>
              </div>

              <div className="app-surface-subtle rounded-2xl p-4">
                <div className="app-subtle text-xs font-semibold uppercase tracking-wide">
                  Uploaded
                </div>
                <div className="mt-2 text-sm">
                  {formatDateTime(report.createdAt)}
                </div>
              </div>

              <div className="app-surface-subtle rounded-2xl p-4">
                <div className="app-subtle text-xs font-semibold uppercase tracking-wide">
                  Published
                </div>
                <div className="mt-2 text-sm">
                  {report.publishedAt ? formatDateTime(report.publishedAt) : "Not published yet"}
                </div>
              </div>
            </div>
          </div>

          <div className="app-surface rounded-3xl p-6">
            <h2 className="text-lg font-semibold">Report Summary</h2>

            <div className="mt-4 app-surface-subtle rounded-2xl p-5">
              {report.summary?.trim() ? (
                <p className="whitespace-pre-wrap text-sm leading-6">
                  {report.summary}
                </p>
              ) : (
                <p className="app-subtle text-sm">
                  No summary has been added yet.
                </p>
              )}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="app-surface-subtle rounded-2xl p-4">
                <div className="app-subtle text-xs font-semibold uppercase tracking-wide">
                  Extraction Status
                </div>
                <div className="mt-2 text-sm">{report.extractionStatus}</div>
              </div>

              <div className="app-surface-subtle rounded-2xl p-4">
                <div className="app-subtle text-xs font-semibold uppercase tracking-wide">
                  Seller
                </div>
                <div className="mt-2 text-sm">
                  {report.seller.name?.trim() || report.seller.email}
                </div>
              </div>
            </div>
          </div>

          <div className="app-surface rounded-3xl p-6">
            <h2 className="text-lg font-semibold">Included Files</h2>

            {report.files.length === 0 ? (
              <div className="mt-4 app-surface-subtle rounded-2xl p-4 text-sm app-subtle">
                No report files have been uploaded yet.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {report.files.map((file) => (
                  <div
                    key={file.id}
                    className="app-surface-subtle rounded-2xl p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{file.originalFilename}</div>
                        <div className="app-subtle mt-1 text-sm">
                          {file.kind} · {file.mimeType}
                          {typeof file.pageCount === "number"
                            ? ` · ${file.pageCount} pages`
                            : ""}
                        </div>
                      </div>

                      <div className="app-subtle text-sm">
                        {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="app-surface rounded-3xl p-6">
            <h2 className="text-lg font-semibold">Access</h2>

            <div className="mt-4 space-y-4">
              {!isPublished ? (
                <div className="alert-warning rounded-2xl px-4 py-3 text-sm">
                  This report is not currently published for marketplace purchase.
                </div>
              ) : null}

              {!isLoggedIn ? (
                <div className="app-surface-subtle rounded-2xl px-4 py-4">
                  <p className="app-muted text-sm">
                    Sign in to purchase and view this report.
                  </p>

                  <div className="mt-4">
                    <Link
                      href={`/sign-in?redirect_url=${encodeURIComponent(`/report/${report.id}`)}`}
                      className="app-button-primary w-full px-5 py-3 text-sm"
                    >
                      Sign In to Continue
                    </Link>
                  </div>
                </div>
              ) : (
                <ReportAccessActions
                  reportId={report.id}
                  hasAccess={hasAccess}
                  isOwnerOrAdmin={Boolean(isSeller || isAdmin)}
                  priceLabel={`$${(report.priceCents / 100).toFixed(0)}`}
                />
              )}

              {canPurchase ? (
                <p className="app-subtle text-xs leading-5">
                  Secure checkout grants view-only access to this inspection report.
                </p>
              ) : null}
            </div>
          </div>

          <div className="app-surface rounded-3xl p-6">
            <h2 className="text-lg font-semibold">What You’ll Get</h2>

            <ul className="app-muted mt-4 space-y-3 text-sm">
              <li>Full inspection document access</li>
              <li>Secure view-only delivery</li>
              <li>Short-lived signed file access</li>
              <li>Fast online viewing for PDF and image reports</li>
            </ul>
          </div>

          <div className="app-surface rounded-3xl p-6">
            <h2 className="text-lg font-semibold">Coordinates</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="app-surface-subtle rounded-2xl p-4">
                <div className="app-subtle text-xs font-semibold uppercase tracking-wide">
                  Latitude
                </div>
                <div className="mt-2 text-sm">{report.property.lat}</div>
              </div>

              <div className="app-surface-subtle rounded-2xl p-4">
                <div className="app-subtle text-xs font-semibold uppercase tracking-wide">
                  Longitude
                </div>
                <div className="mt-2 text-sm">{report.property.lng}</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}