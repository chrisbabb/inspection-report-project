import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { PropertySearchInput } from "@/lib/validators/search";

type Bounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

function buildLongitudeWhere(bounds: Bounds): Prisma.PropertyWhereInput {
  if (bounds.west <= bounds.east) {
    return {
      lng: {
        gte: bounds.west,
        lte: bounds.east,
      },
    };
  }

  return {
    OR: [
      {
        lng: {
          gte: bounds.west,
        },
      },
      {
        lng: {
          lte: bounds.east,
        },
      },
    ],
  };
}

function buildBoundsWhere(bounds?: Bounds): Prisma.PropertyWhereInput | undefined {
  if (!bounds) return undefined;

  return {
    AND: [
      {
        lat: {
          gte: bounds.south,
          lte: bounds.north,
        },
      },
      buildLongitudeWhere(bounds),
    ],
  };
}

function buildQueryWhere(query: string): Prisma.PropertyWhereInput | undefined {
  const q = query.trim();
  if (!q) return undefined;

  return {
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
  };
}

export async function searchMarketplaceProperties(input: PropertySearchInput) {
  const query = input.q.trim();

  const bounds =
    input.north !== undefined &&
    input.south !== undefined &&
    input.east !== undefined &&
    input.west !== undefined
      ? {
          north: input.north,
          south: input.south,
          east: input.east,
          west: input.west,
        }
      : undefined;

  const whereClauses: Prisma.PropertyWhereInput[] = [
    {
      reports: {
        some: {
          status: "PUBLISHED",
        },
      },
    },
  ];

  const queryWhere = buildQueryWhere(query);
  if (queryWhere) {
    whereClauses.push(queryWhere);
  }

  const boundsWhere = buildBoundsWhere(bounds);
  if (boundsWhere) {
    whereClauses.push(boundsWhere);
  }

  const where: Prisma.PropertyWhereInput =
    whereClauses.length === 1 ? whereClauses[0] : { AND: whereClauses };

  return db.property.findMany({
    where,
    orderBy: [
      {
        updatedAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
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
          priceCents: true,
        },
      },
    },
    take: query ? 100 : 250,
  });
}