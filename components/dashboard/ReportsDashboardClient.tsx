"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import PropertyAutocompleteInput, {
  type SelectedPropertyAddress,
} from "@/components/dashboard/PropertyAutocompleteInput";

type ReportFile = {
  id: string;
  kind: "PDF" | "IMAGE";
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
};

type PropertySummary = {
  id: string;
  formattedAddress: string;
  city: string;
  state: string;
  zip: string;
};

type SellerReport = {
  id: string;
  inspectionDate: string;
  title: string | null;
  summary: string | null;
  priceCents: number;
  status: "DRAFT" | "PROCESSING" | "PUBLISHED" | "REMOVED";
  extractionStatus: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  property: PropertySummary;
  files: ReportFile[];
};

type PurchasedReport = {
  accessId: string;
  grantedAt: string;
  report: {
    id: string;
    title: string | null;
    inspectionDate: string;
    priceCents: number;
    property: {
      formattedAddress: string;
      city: string;
      state: string;
      zip: string;
    };
    seller: {
      name: string | null;
      email: string;
    };
  };
  purchase: {
    id: string;
    amountCents: number;
    purchasedAt: string | null;
  } | null;
};

type DashboardPayload = {
  subscription: {
    status: string | null;
    plan: string | null;
    isActive: boolean;
  };
  sellerReports: SellerReport[];
  purchasedReports: PurchasedReport[];
};

type PropertyCreateResponse = {
  id: string;
  placeId: string;
  formattedAddress: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  createdAt: string;
  updatedAt: string;
};

type UploadUrlResponse = {
  reportId: string;
  kind: "PDF" | "IMAGE";
  filename: string;
  contentType: string;
  fileId: string;
  storageKey: string;
  uploadUrl: string;
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

type CreateReportFormState = {
  addressQuery: string;
  selectedAddress: SelectedPropertyAddress | null;
  inspectionDate: string;
  title: string;
};

type EditReportFormState = {
  title: string;
  summary: string;
  inspectionDate: string;
  status: "DRAFT" | "PUBLISHED" | "REMOVED";
};

function toDateInputValue(isoString: string) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function getFileKind(file: File): "PDF" | "IMAGE" {
  return file.type === "application/pdf" ? "PDF" : "IMAGE";
}

const inputClass = "dashboard-input";
const panelClass = "dashboard-panel";
const subPanelClass = "dashboard-subpanel";
const mutedTextClass = "dashboard-muted";
const subtleTextClass = "dashboard-subtle";
const dividerClass = "dashboard-divider";

export default function ReportsDashboardClient() {
  const router = useRouter();
  const [reports, setReports] = useState<SellerReport[]>([]);
  const [purchasedReports, setPurchasedReports] = useState<PurchasedReport[]>([]);
  const [subscription, setSubscription] = useState<DashboardPayload["subscription"]>({
    status: null,
    plan: null,
    isActive: false,
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateReportFormState>({
    addressQuery: "",
    selectedAddress: null,
    inspectionDate: "",
    title: "",
  });

  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [editForms, setEditForms] = useState<Record<string, EditReportFormState>>(
    {},
  );
  const [savingReportIds, setSavingReportIds] = useState<Record<string, boolean>>(
    {},
  );
  const [deletingReportIds, setDeletingReportIds] = useState<Record<string, boolean>>(
    {},
  );
  const [uploadingReportIds, setUploadingReportIds] = useState<Record<string, boolean>>(
    {},
  );

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function loadDashboard() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/dashboard/reports", {
        method: "GET",
        cache: "no-store",
      });

      const json: ApiResponse<DashboardPayload> = await response.json();

      if (!json.ok) {
        throw new Error(json.error.message);
      }

      setReports(json.data.sellerReports);
      setPurchasedReports(json.data.purchasedReports);
      setSubscription(json.data.subscription);

      const nextEditForms: Record<string, EditReportFormState> = {};
      for (const report of json.data.sellerReports) {
        nextEditForms[report.id] = {
          title: report.title ?? "",
          summary: report.summary ?? "",
          inspectionDate: toDateInputValue(report.inspectionDate),
          status:
            report.status === "REMOVED"
              ? "DRAFT"
              : (report.status as "DRAFT" | "PUBLISHED"),
        };
      }

      setEditForms(nextEditForms);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load dashboard",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const handleAddressInputChange = useCallback((value: string) => {
    setCreateForm((prev) => ({
      ...prev,
      addressQuery: value,
      selectedAddress: null,
    }));
  }, []);

  const handleAddressSelect = useCallback((address: SelectedPropertyAddress) => {
    setCreateForm((prev) => ({
      ...prev,
      addressQuery: address.formattedAddress,
      selectedAddress: address,
    }));
  }, []);

  async function handleCreateReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!subscription.isActive) {
      setErrorMessage("An active subscription is required before you can add a report.");
      return;
    }

    setCreateSubmitting(true);
    setErrorMessage(null);

    try {
      if (!createForm.selectedAddress) {
        throw new Error("Please select a property address from the suggestions.");
      }

      const propertyPayload = {
        placeId: createForm.selectedAddress.placeId,
        formattedAddress: createForm.selectedAddress.formattedAddress,
        street: createForm.selectedAddress.street,
        city: createForm.selectedAddress.city,
        state: createForm.selectedAddress.state,
        zip: createForm.selectedAddress.zip,
        lat: createForm.selectedAddress.lat,
        lng: createForm.selectedAddress.lng,
      };

      const propertyResponse = await fetch("/api/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(propertyPayload),
      });

      const propertyJson: ApiResponse<PropertyCreateResponse> =
        await propertyResponse.json();

      if (!propertyJson.ok) {
        throw new Error(propertyJson.error.message);
      }

      const reportPayload = {
        propertyId: propertyJson.data.id,
        inspectionDate: new Date(createForm.inspectionDate).toISOString(),
        title: createForm.title.trim() || undefined,
      };

      const reportResponse = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reportPayload),
      });

      const reportJson: ApiResponse<unknown> = await reportResponse.json();

      if (!reportJson.ok) {
        throw new Error(reportJson.error.message);
      }

      setCreateForm({
        addressQuery: "",
        selectedAddress: null,
        inspectionDate: "",
        title: "",
      });

      await loadDashboard();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create report",
      );
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function handleSaveReport(reportId: string) {
    const form = editForms[reportId];
    if (!form) return;

    setSavingReportIds((prev) => ({ ...prev, [reportId]: true }));
    setErrorMessage(null);

    try {
      const payload = {
        title: form.title.trim() || null,
        summary: form.summary.trim() || null,
        inspectionDate: form.inspectionDate
          ? new Date(form.inspectionDate).toISOString()
          : undefined,
        status: form.status,
      };

      const response = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json: ApiResponse<unknown> = await response.json();

      if (!json.ok) {
        throw new Error(json.error.message);
      }

      await loadDashboard();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save report",
      );
    } finally {
      setSavingReportIds((prev) => ({ ...prev, [reportId]: false }));
    }
  }

  async function handleDeleteReport(reportId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to remove this report?",
    );
    if (!confirmed) return;

    setDeletingReportIds((prev) => ({ ...prev, [reportId]: true }));
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: "DELETE",
      });

      const json: ApiResponse<unknown> = await response.json();

      if (!json.ok) {
        throw new Error(json.error.message);
      }

      await loadDashboard();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to remove report",
      );
    } finally {
      setDeletingReportIds((prev) => ({ ...prev, [reportId]: false }));
    }
  }

  async function handleAutoPublishReport(reportId: string) {
    const form = editForms[reportId];

    const payload = {
      title: form?.title.trim() || null,
      summary: form?.summary.trim() || null,
      inspectionDate: form?.inspectionDate
        ? new Date(form.inspectionDate).toISOString()
        : undefined,
      status: "PUBLISHED" as const,
    };

    const response = await fetch(`/api/reports/${reportId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json: ApiResponse<unknown> = await response.json();

    if (!json.ok) {
      throw new Error(json.error.message);
    }
  }

  async function handleFileSelected(reportId: string, file: File | null) {
    if (!file) return;

    setUploadingReportIds((prev) => ({ ...prev, [reportId]: true }));
    setErrorMessage(null);

    try {
      const uploadRequestPayload = {
        kind: getFileKind(file),
        filename: file.name,
        contentType: file.type,
      };

      const uploadUrlResponse = await fetch(`/api/reports/${reportId}/upload-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(uploadRequestPayload),
      });

      const uploadUrlJson: ApiResponse<UploadUrlResponse> =
        await uploadUrlResponse.json();

      if (!uploadUrlJson.ok) {
        throw new Error(uploadUrlJson.error.message);
      }

      const uploadResponse = await fetch(uploadUrlJson.data.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to storage.");
      }

      const registerResponse = await fetch(`/api/reports/${reportId}/files`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: uploadUrlJson.data.kind,
          storageKey: uploadUrlJson.data.storageKey,
          originalFilename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          sortOrder: 0,
        }),
      });

      const registerJson: ApiResponse<unknown> = await registerResponse.json();

      if (!registerJson.ok) {
        throw new Error(registerJson.error.message);
      }

      if (uploadUrlJson.data.kind === "PDF") {
        await handleAutoPublishReport(reportId);
      }

      if (fileInputRefs.current[reportId]) {
        fileInputRefs.current[reportId]!.value = "";
      }

      await loadDashboard();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to upload file",
      );
    } finally {
      setUploadingReportIds((prev) => ({ ...prev, [reportId]: false }));
    }
  }

  const subscriptionStatusLabel = subscription.status
    ? subscription.status.replace(/_/g, " ")
    : "inactive";

  return (
    <div className="dashboard-page min-h-[calc(100vh-72px)] px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--text)]">My Home Inspection Dashboard</h1>
          <p className={`${mutedTextClass} mt-2 text-sm`}>
            Manage your listings, billing status, and purchased reports.
          </p>
        </div>

        {errorMessage ? (
          <div className="alert-danger rounded-2xl px-4 py-3 text-sm">
            {errorMessage}
          </div>
        ) : null}

        <section className={panelClass}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--text)]">Seller Subscription</h2>
              <p className={`${mutedTextClass} mt-1 text-sm`}>
                You need an active subscription before you can add a new inspection report.
              </p>
            </div>

            <div className="app-surface-subtle rounded-2xl px-4 py-3 text-sm">
              <div>
                <span className="font-medium">Status:</span> {subscriptionStatusLabel}
              </div>
              <div>
                <span className="font-medium">Plan:</span> {subscription.plan ?? "none"}
              </div>
            </div>
          </div>

          {subscription.isActive ? (
            <div className="alert-success mt-5 rounded-2xl px-4 py-4 text-sm">
              Your seller subscription is active. You can add and manage report listings.
            </div>
          ) : (
            <div className="alert-warning mt-5 rounded-2xl px-4 py-4">
              <div className="subscription-warning-copy space-y-2 text-sm">
                <p>
                  Your seller subscription is not active, so creating new reports is locked until billing is active.
                </p>
                <p>
                  Once subscribed, you can post inspection reports and earn <strong>$40</strong> each time one of your reports sells.
                  The more reports you post, the more earning potential you have.
                </p>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => router.push("/billing")}
                  className="app-button-primary"
                >
                  Subscribe
                </button>
              </div>
            </div>
          )}
        </section>

        <section className={panelClass}>
          <h2 className="text-xl font-semibold text-[var(--text)]">Create Report</h2>
          <p className={`${mutedTextClass} mt-1 text-sm`}>
            Search for the property address, select it, then create the report. Uploading a PDF will automatically publish it to the marketplace.
          </p>

          {!subscription.isActive ? (
            <div className="app-surface-subtle mt-6 rounded-2xl px-4 py-4 text-sm dashboard-muted">
              Creating a report is disabled until your seller subscription is active.
            </div>
          ) : (
            <form onSubmit={handleCreateReport} className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium">Property Address</span>
                <PropertyAutocompleteInput
                  value={createForm.addressQuery}
                  onInputChange={handleAddressInputChange}
                  onSelect={handleAddressSelect}
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium">Inspection Date</span>
                <input
                  type="date"
                  className={inputClass}
                  value={createForm.inspectionDate}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      inspectionDate: e.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium">Title</span>
                <input
                  className={inputClass}
                  value={createForm.title}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                />
              </label>

              {createForm.selectedAddress ? (
                <div className={`${subPanelClass} md:col-span-2`}>
                  <div className="text-sm">
                    <strong>Selected:</strong> {createForm.selectedAddress.formattedAddress}
                  </div>
                </div>
              ) : null}

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="app-button-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createSubmitting ? "Creating..." : "Create Report"}
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[var(--text)]">Your Reports</h2>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="app-button-secondary px-4 py-2"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className={panelClass}>Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className={panelClass}>No reports yet.</div>
          ) : (
            <div className="space-y-6">
              {reports.map((report) => {
                const form = editForms[report.id];
                const fileInputId = `report-upload-${report.id}`;

                return (
                  <article key={report.id} className={panelClass}>
                    <div
                      className={`${dividerClass} flex flex-col gap-2 border-b pb-4 md:flex-row md:items-start md:justify-between`}
                    >
                      <div>
                        <h3 className="text-lg font-semibold text-[var(--text)]">
                          {report.title || "Untitled Report"}
                        </h3>
                        <p className={`${mutedTextClass} text-sm`}>
                          {report.property.formattedAddress}
                        </p>
                        <div className={`${subtleTextClass} mt-1 space-y-1 text-sm`}>
                          <p>
                            Status: <span className="font-medium">{report.status}</span>
                          </p>
                          {report.status !== "PUBLISHED" ? (
                            <p className="text-xs text-amber-800 dark:text-amber-300">
                              Upload a PDF to publish this report to the marketplace.
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className={`${subtleTextClass} text-sm`}>
                        <div>Inspection: {toDateInputValue(report.inspectionDate)}</div>
                        <div>Files: {report.files.length}</div>
                        <div>Extraction: {report.extractionStatus}</div>
                      </div>
                    </div>

                    {form ? (
                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <label className="space-y-1">
                          <span className="text-sm font-medium">Title</span>
                          <input
                            className={inputClass}
                            value={form.title}
                            onChange={(e) =>
                              setEditForms((prev) => ({
                                ...prev,
                                [report.id]: {
                                  ...prev[report.id],
                                  title: e.target.value,
                                },
                              }))
                            }
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="text-sm font-medium">Inspection Date</span>
                          <input
                            type="date"
                            className={inputClass}
                            value={form.inspectionDate}
                            onChange={(e) =>
                              setEditForms((prev) => ({
                                ...prev,
                                [report.id]: {
                                  ...prev[report.id],
                                  inspectionDate: e.target.value,
                                },
                              }))
                            }
                          />
                        </label>

                        <label className="space-y-1 md:col-span-2">
                          <span className="text-sm font-medium">Status</span>
                          <select
                            className={inputClass}
                            value={form.status}
                            onChange={(e) =>
                              setEditForms((prev) => ({
                                ...prev,
                                [report.id]: {
                                  ...prev[report.id],
                                  status: e.target.value as "DRAFT" | "PUBLISHED" | "REMOVED",
                                },
                              }))
                            }
                          >
                            <option value="DRAFT">DRAFT</option>
                            <option value="PUBLISHED">PUBLISHED</option>
                            <option value="REMOVED">REMOVED</option>
                          </select>
                        </label>

                        <label className="space-y-1 md:col-span-2">
                          <span className="text-sm font-medium">Summary</span>
                          <textarea
                            className={`${inputClass} min-h-28`}
                            value={form.summary}
                            onChange={(e) =>
                              setEditForms((prev) => ({
                                ...prev,
                                [report.id]: {
                                  ...prev[report.id],
                                  summary: e.target.value,
                                },
                              }))
                            }
                          />
                        </label>

                        <div className={`${subPanelClass} md:col-span-2`}>
                          <div className="mb-3 text-sm font-medium">Upload Inspection File</div>
                          <input
                            id={fileInputId}
                            ref={(el) => {
                              fileInputRefs.current[report.id] = el;
                            }}
                            type="file"
                            accept=".pdf,image/png,image/jpeg,image/webp"
                            onChange={(e) =>
                              void handleFileSelected(
                                report.id,
                                e.target.files?.[0] ?? null,
                              )
                            }
                            disabled={uploadingReportIds[report.id]}
                            className="sr-only"
                          />
                          <div className="flex flex-wrap items-center gap-3">
                            <label
                              htmlFor={fileInputId}
                              className={`app-button-secondary cursor-pointer px-4 py-2 ${
                                uploadingReportIds[report.id] ? "pointer-events-none opacity-60" : ""
                              }`}
                            >
                              {uploadingReportIds[report.id] ? "Uploading..." : "Choose File"}
                            </label>

                            <span className={`${subtleTextClass} text-xs`}>
                              Allowed: PDF, PNG, JPG, WEBP. Uploading a PDF publishes the report automatically.
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 md:col-span-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveReport(report.id)}
                            disabled={savingReportIds[report.id]}
                            className="app-button-primary disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingReportIds[report.id] ? "Saving..." : "Save Changes"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDeleteReport(report.id)}
                            disabled={deletingReportIds[report.id]}
                            className="app-button-danger disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingReportIds[report.id] ? "Removing..." : "Remove Report"}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {report.files.length > 0 ? (
                      <div className={`${dividerClass} mt-6 border-t pt-4`}>
                        <h4 className="text-sm font-semibold text-[var(--text)]">Attached Files</h4>
                        <ul className={`${mutedTextClass} mt-2 space-y-2 text-sm`}>
                          {report.files.map((file) => (
                            <li
                              key={file.id}
                              className="dashboard-subpanel rounded-2xl px-4 py-3"
                            >
                              {file.originalFilename} · {file.kind} · {file.mimeType}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div
                        className={`${dividerClass} ${subtleTextClass} mt-6 border-t pt-4 text-sm`}
                      >
                        No files attached yet.
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[var(--text)]">Purchased Reports</h2>
          </div>

          {loading ? (
            <div className={panelClass}>Loading purchased reports...</div>
          ) : purchasedReports.length === 0 ? (
            <div className={panelClass}>You have not purchased any reports yet.</div>
          ) : (
            <div className="space-y-4">
              {purchasedReports.map((entry) => (
                <article key={entry.accessId} className={panelClass}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--text)]">
                        {entry.report.title || "Home Inspection Report"}
                      </h3>
                      <p className={`${mutedTextClass} mt-1 text-sm`}>
                        {entry.report.property.formattedAddress}
                      </p>
                      <div className={`${subtleTextClass} mt-3 space-y-1 text-sm`}>
                        <p>Inspection date: {formatDate(entry.report.inspectionDate)}</p>
                        <p>
                          Purchased: {formatDate(entry.purchase?.purchasedAt ?? entry.grantedAt)}
                        </p>
                        <p>
                          Seller:{" "}
                          {entry.report.seller.name?.trim() || entry.report.seller.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-3 md:items-end">
                      <div className="alert-success rounded-2xl px-3 py-2 text-sm font-semibold">
                        Owned
                      </div>
                      <div className={`${subtleTextClass} text-sm`}>
                        Paid {formatMoney(entry.purchase?.amountCents ?? entry.report.priceCents)}
                      </div>
                      <Link
                        href={`/report/${entry.report.id}`}
                        className="app-button-primary px-4 py-2"
                      >
                        Open Report
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
