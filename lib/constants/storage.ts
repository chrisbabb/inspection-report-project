export const STORAGE_PREFIX_REPORTS = "reports";
export const STORAGE_DIR_ORIGINAL = "original";
export const STORAGE_DIR_DERIVED = "derived";
export const STORAGE_DIR_PAGE_IMAGES = "page-images";
export const STORAGE_DIR_TEXT = "text";
export const STORAGE_DIR_STRUCTURED = "structured";

export function sanitizeFilename(filename: string) {
  return filename
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

export function buildOriginalReportStorageKey(params: {
  sellerUserId: string;
  reportId: string;
  fileId: string;
  originalFilename: string;
}) {
  const safeFilename = sanitizeFilename(params.originalFilename);

  return [
    STORAGE_PREFIX_REPORTS,
    params.sellerUserId,
    params.reportId,
    STORAGE_DIR_ORIGINAL,
    `${params.fileId}-${safeFilename}`,
  ].join("/");
}

export function buildDerivedPageImageStorageKey(params: {
  sellerUserId: string;
  reportId: string;
  pageNumber: number;
}) {
  return [
    STORAGE_PREFIX_REPORTS,
    params.sellerUserId,
    params.reportId,
    STORAGE_DIR_DERIVED,
    STORAGE_DIR_PAGE_IMAGES,
    `${params.pageNumber}.png`,
  ].join("/");
}

export function buildDerivedExtractedTextStorageKey(params: {
  sellerUserId: string;
  reportId: string;
}) {
  return [
    STORAGE_PREFIX_REPORTS,
    params.sellerUserId,
    params.reportId,
    STORAGE_DIR_DERIVED,
    STORAGE_DIR_TEXT,
    "extracted.json",
  ].join("/");
}

export function buildDerivedStructuredReportStorageKey(params: {
  sellerUserId: string;
  reportId: string;
}) {
  return [
    STORAGE_PREFIX_REPORTS,
    params.sellerUserId,
    params.reportId,
    STORAGE_DIR_DERIVED,
    STORAGE_DIR_STRUCTURED,
    "report.json",
  ].join("/");
}