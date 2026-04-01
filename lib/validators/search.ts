import { z } from "zod";

const coordinate = z.coerce.number().finite();

export const propertySearchSchema = z
  .object({
    q: z.string().trim().max(200).optional().default(""),
    north: coordinate.optional(),
    south: coordinate.optional(),
    east: coordinate.optional(),
    west: coordinate.optional(),
  })
  .superRefine((value, ctx) => {
    const hasAnyBounds =
      value.north !== undefined ||
      value.south !== undefined ||
      value.east !== undefined ||
      value.west !== undefined;

    const hasAllBounds =
      value.north !== undefined &&
      value.south !== undefined &&
      value.east !== undefined &&
      value.west !== undefined;

    if (hasAnyBounds && !hasAllBounds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "north, south, east, and west must all be provided together",
        path: ["north"],
      });
    }
  });

export type PropertySearchInput = z.infer<typeof propertySearchSchema>;