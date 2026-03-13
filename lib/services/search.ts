import { db } from "@/lib/db";

export async function searchMarketplaceProperties(query: string) {
  const q = query.trim();

  if (!q) {
    return [];
  }

  return db.property.findMany({
    where: {
      OR: [
        {
          formattedAddress: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          street: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          city: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          zip: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      placeId: true,
      formattedAddress: true,
      street: true,
      city: true,
      state: true,
      zip: true,
      lat: true,
      lng: true,
      reports: {
        where: {
          status: "PUBLISHED",
        },
        orderBy: {
          inspectionDate: "desc",
        },
        select: {
          id: true,
          title: true,
          summary: true,
          inspectionDate: true,
          status: true,
          createdAt: true,
        },
      },
    },
    take: 100,
  });
}