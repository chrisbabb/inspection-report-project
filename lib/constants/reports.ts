export const REPORT_STATUSES = {
  DRAFT: "DRAFT",
  PROCESSING: "PROCESSING",
  PUBLISHED: "PUBLISHED",
  REMOVED: "REMOVED",
} as const;

export type ReportStatus = (typeof REPORT_STATUSES)[keyof typeof REPORT_STATUSES];

export const EXTRACTION_STATUSES = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETE: "COMPLETE",
  FAILED: "FAILED",
} as const;

export type ExtractionStatus =
  (typeof EXTRACTION_STATUSES)[keyof typeof EXTRACTION_STATUSES];

export const REPORT_FILE_KINDS = {
  PDF: "PDF",
  IMAGE: "IMAGE",
} as const;

export type ReportFileKind =
  (typeof REPORT_FILE_KINDS)[keyof typeof REPORT_FILE_KINDS];

export const ALLOWED_REPORT_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedReportUploadMimeType =
  (typeof ALLOWED_REPORT_UPLOAD_MIME_TYPES)[number];