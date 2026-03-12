import { randomUUID } from "crypto";
import { createPresignedUploadUrl } from "@/lib/s3";
import { buildOriginalReportStorageKey } from "@/lib/constants/storage";

export async function createReportFileUpload(params: {
  sellerUserId: string;
  reportId: string;
  filename: string;
  contentType: string;
}) {
  const fileId = randomUUID();

  const storageKey = buildOriginalReportStorageKey({
    sellerUserId: params.sellerUserId,
    reportId: params.reportId,
    fileId,
    originalFilename: params.filename,
  });

  const uploadUrl = await createPresignedUploadUrl({
    key: storageKey,
    contentType: params.contentType,
    expiresIn: 300,
  });

  return {
    fileId,
    storageKey,
    uploadUrl,
  };
}