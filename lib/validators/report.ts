import { z } from "zod";
import { cuidSchema, isoDateSchema } from "./common";
import { ALLOWED_REPORT_UPLOAD_MIME_TYPES } from "@/lib/constants/reports";

export const reportCreateSchema = z.object({
  propertyId: cuidSchema,
  inspectionDate: isoDateSchema,
  title: z.string().max(160).optional(),
  priceCents: z.number().int().positive().optional(),
});

export type ReportCreateInput = z.infer<typeof reportCreateSchema>;

export const reportUpdateSchema = z.object({
  inspectionDate: isoDateSchema.optional(),
  title: z.string().max(160).nullable().optional(),
  summary: z.string().max(5000).nullable().optional(),
  priceCents: z.number().int().positive().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "REMOVED"]).optional(),
});

export type ReportUpdateInput = z.infer<typeof reportUpdateSchema>;

export const reportFileCreateSchema = z.object({
  reportId: cuidSchema,
  kind: z.enum(["PDF", "IMAGE"]),
  storageKey: z.string().min(1),
  originalFilename: z.string().min(1).max(500),
  mimeType: z.enum(ALLOWED_REPORT_UPLOAD_MIME_TYPES),
  sizeBytes: z.number().int().positive(),
  sortOrder: z.number().int().min(0).default(0),
  pageCount: z.number().int().positive().optional(),
});

export type ReportFileCreateInput = z.infer<typeof reportFileCreateSchema>;