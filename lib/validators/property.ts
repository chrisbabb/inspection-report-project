import { z } from "zod";
import { placeIdSchema, latSchema, lngSchema } from "./common";

export const propertyUpsertSchema = z.object({
  placeId: placeIdSchema,
  formattedAddress: z.string().min(1).max(500),

  street: z.string().min(1).max(255),
  city: z.string().min(1).max(120),
  state: z.string().min(1).max(50),
  zip: z.string().min(3).max(20),

  lat: latSchema,
  lng: lngSchema,
});

export type PropertyUpsertInput = z.infer<typeof propertyUpsertSchema>;