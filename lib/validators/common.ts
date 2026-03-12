import { z } from "zod";

export const cuidSchema = z.string().cuid();

export const placeIdSchema = z.string().min(1).max(255);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const latSchema = z
  .number()
  .min(-90)
  .max(90);

export const lngSchema = z
  .number()
  .min(-180)
  .max(180);

export const isoDateSchema = z.coerce.date();