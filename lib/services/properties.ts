import { db } from "@/lib/db";
import type { PropertyUpsertInput } from "@/lib/validators/property";

export async function upsertProperty(input: PropertyUpsertInput) {
  return db.property.upsert({
    where: { placeId: input.placeId },
    update: {
      formattedAddress: input.formattedAddress,
      street: input.street,
      city: input.city,
      state: input.state,
      zip: input.zip,
      lat: input.lat,
      lng: input.lng,
    },
    create: {
      placeId: input.placeId,
      formattedAddress: input.formattedAddress,
      street: input.street,
      city: input.city,
      state: input.state,
      zip: input.zip,
      lat: input.lat,
      lng: input.lng,
    },
  });
}

export async function getPropertyById(propertyId: string) {
  return db.property.findUnique({
    where: { id: propertyId },
    include: {
      reports: {
        where: {
          status: "PUBLISHED",
        },
        orderBy: {
          inspectionDate: "desc",
        },
        select: {
          id: true,
          inspectionDate: true,
          priceCents: true,
          title: true,
          summary: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });
}