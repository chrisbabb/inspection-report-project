"use client";

import { useEffect, useState } from "react";

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

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

type CreateReportFormState = {
  placeId: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: string;
  lng: string;
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

function buildFormattedAddress(form: CreateReportFormState) {
  return `${form.street.trim()}, ${form.city.trim()}, ${form.state.trim()} ${form.zip.trim()}`;
}

export default function ReportsDashboardClient() {
  const [reports, setReports] = useState<SellerReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<CreateReportFormState>({
    placeId: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    lat: "",
    lng: "",
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
      const lat = Number(createForm.lat);
      const lng = Number(createForm.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("Latitude and longitude must be valid numbers.");
      }

      const propertyPayload = {
        placeId: createForm.placeId.trim(),
        formattedAddress: buildFormattedAddress(createForm),
        street: createForm.street.trim(),
        city: createForm.city.trim(),
        state: createForm.state.trim(),
        zip: createForm.zip.trim(),
        lat,
        lng,
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
        placeId: "",
        street: "",
        city: "",
        state: "",
        zip: "",
        lat: "",
        lng: "",
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

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-3xl font-semibold">My Home Inspection Reports</h1>
        <p className="mt-2 text-sm text-gray-600">
          Create, update, and manage your report listings.
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Create Draft Report</h2>
        <p className="mt-1 text-sm text-gray-600">
          Enter property details. For now, use a unique place ID manually. We’ll
          replace this with Google Places autocomplete in a later step.
        </p>

        <form onSubmit={handleCreateReport} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">Place ID</span>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={createForm.placeId}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, placeId: e.target.value }))
              }
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Street</span>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={createForm.street}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, street: e.target.value }))
              }
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">City</span>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={createForm.city}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, city: e.target.value }))
              }
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">State</span>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={createForm.state}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, state: e.target.value }))
              }
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">ZIP</span>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={createForm.zip}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, zip: e.target.value }))
              }
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Latitude</span>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={createForm.lat}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, lat: e.target.value }))
              }
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Longitude</span>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={createForm.lng}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, lng: e.target.value }))
              }
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Inspection Date</span>
            <input
              type="date"
              className="w-full rounded-lg border px-3 py-2"
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

          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium">Title</span>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={createForm.title}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, title: e.target.value }))
              }
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={createSubmitting}
              className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
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
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            No reports yet.
          </div>
        ) : (
          <div className="space-y-6">
            {reports.map((report) => {
              const form = editForms[report.id];

              return (
                <article
                  key={report.id}
                  className="rounded-2xl border bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-2 border-b pb-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {report.title || "Untitled Report"}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {report.property.formattedAddress}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Status: <span className="font-medium">{report.status}</span>
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
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
                          className="w-full rounded-lg border px-3 py-2"
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
                          className="w-full rounded-lg border px-3 py-2"
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
                          className="w-full rounded-lg border px-3 py-2"
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
                          className="min-h-28 w-full rounded-lg border px-3 py-2"
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

                      <div className="md:col-span-2 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void handleSaveReport(report.id)}
                          disabled={savingReportIds[report.id]}
                          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
                        >
                          {savingReportIds[report.id] ? "Saving..." : "Save Changes"}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDeleteReport(report.id)}
                          disabled={deletingReportIds[report.id]}
                          className="rounded-lg border border-red-300 px-4 py-2 text-red-700 disabled:opacity-50"
                        >
                          {deletingReportIds[report.id] ? "Removing..." : "Remove Report"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {report.files.length > 0 ? (
                    <div className="mt-6 border-t pt-4">
                      <h4 className="text-sm font-semibold">Attached Files</h4>
                      <ul className="mt-2 space-y-2 text-sm text-gray-600">
                        {report.files.map((file) => (
                          <li key={file.id} className="rounded-lg border px-3 py-2">
                            {file.originalFilename} · {file.kind} · {file.mimeType}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="mt-6 border-t pt-4 text-sm text-gray-500">
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
  );
}