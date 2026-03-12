import { z } from "zod";
import { ALLOWED_REPORT_UPLOAD_MIME_TYPES } from "@/lib/constants/reports";

export const createReportUploadUrlSchema = z.object({
  kind: z.enum(["PDF", "IMAGE"]),
  filename: z.string().min(1).max(500),
  contentType: z.enum(ALLOWED_REPORT_UPLOAD_MIME_TYPES),
});

export type CreateReportUploadUrlInput = z.infer<
  typeof createReportUploadUrlSchema
>;