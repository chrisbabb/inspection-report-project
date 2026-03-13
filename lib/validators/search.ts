import { z } from "zod";

export const propertySearchSchema = z.object({
  q: z.string().trim().min(1).max(200),
});

export type PropertySearchInput = z.infer<typeof propertySearchSchema>;