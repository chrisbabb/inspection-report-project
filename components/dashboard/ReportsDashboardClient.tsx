"use client";

import { useEffect, useRef, useState } from "react";
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
  const [reports, setReports] = useState<SellerReport[]>([]);
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

  async function loadReports() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/dashboard/reports", {
        method: "GET",
        cache: "no-store",
      });

      const json: ApiResponse<SellerReport[]> = await response.json();

      if (!json.ok) {
        throw new Error(json.error.message);
      }

      setReports(json.data);

      const nextEditForms: Record<string, EditReportFormState> = {};
      for (const report of json.data) {
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
        error instanceof Error ? error.message : "Failed to load reports",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  async function handleCreateReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

      await loadReports();
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

      await loadReports();
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

      await loadReports();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to remove report",
      );
    } finally {
      setDeletingReportIds((prev) => ({ ...prev, [reportId]: false }));
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

      if (fileInputRefs.current[reportId]) {
        fileInputRefs.current[reportId]!.value = "";
      }

      await loadReports();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to upload file",
      );
    } finally {
      setUploadingReportIds((prev) => ({ ...prev, [reportId]: false }));
    }
  }

  return (
    <div className="dashboard-page min-h-[calc(100vh-72px)] px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">My Home Inspection Reports</h1>
          <p className={`${mutedTextClass} mt-2 text-sm`}>
            Create, update, and manage your report listings.
          </p>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {errorMessage}
          </div>
        ) : null}

        <section className={panelClass}>
          <h2 className="text-xl font-semibold">Create Draft Report</h2>
          <p className={`${mutedTextClass} mt-1 text-sm`}>
            Search for the property address, select it, then create the report.
          </p>

          <form onSubmit={handleCreateReport} className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium">Property Address</span>
              <PropertyAutocompleteInput
                value={createForm.addressQuery}
                onChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    addressQuery: value,
                    selectedAddress: null,
                  }))
                }
                onSelect={(address) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    addressQuery: address.formattedAddress,
                    selectedAddress: address,
                  }))
                }
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
                <div className="mt-1 text-sm">
                  <strong>Place ID:</strong> {createForm.selectedAddress.placeId}
                </div>
              </div>
            ) : null}

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={createSubmitting}
                className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:opacity-50"
              >
                {createSubmitting ? "Creating..." : "Create Report"}
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your Reports</h2>
            <button
              type="button"
              onClick={() => void loadReports()}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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

                return (
                  <article key={report.id} className={panelClass}>
                    <div className={`${dividerClass} flex flex-col gap-2 border-b pb-4 md:flex-row md:items-start md:justify-between`}>
                      <div>
                        <h3 className="text-lg font-semibold">
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
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                              Publishing requires at least one attached PDF file.
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
                            className="block w-full text-sm"
                          />
                          <p className={`${subtleTextClass} mt-2 text-xs`}>
                            Allowed: PDF, PNG, JPG, WEBP
                          </p>
                          {uploadingReportIds[report.id] ? (
                            <p className={`${mutedTextClass} mt-2 text-sm`}>
                              Uploading file...
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-3 md:col-span-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveReport(report.id)}
                            disabled={savingReportIds[report.id]}
                            className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:opacity-50"
                          >
                            {savingReportIds[report.id] ? "Saving..." : "Save Changes"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDeleteReport(report.id)}
                            disabled={deletingReportIds[report.id]}
                            className="rounded-2xl border border-red-300 px-5 py-3 text-sm font-semibold text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-300"
                          >
                            {deletingReportIds[report.id] ? "Removing..." : "Remove Report"}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {report.files.length > 0 ? (
                      <div className={`${dividerClass} mt-6 border-t pt-4`}>
                        <h4 className="text-sm font-semibold">Attached Files</h4>
                        <ul className={`${mutedTextClass} mt-2 space-y-2 text-sm`}>
                          {report.files.map((file) => (
                            <li
                              key={file.id}
                              className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800"
                            >
                              {file.originalFilename} · {file.kind} · {file.mimeType}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className={`${dividerClass} ${subtleTextClass} mt-6 border-t pt-4 text-sm`}>
                        No files attached yet.
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}