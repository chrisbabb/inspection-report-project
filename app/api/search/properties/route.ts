import { auth } from "@clerk/nextjs/server";

import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { searchMarketplaceProperties } from "@/lib/services/search";
import {
  getAppUserByClerkUserId,
  syncClerkUserToDb,
} from "@/lib/services/users";
import { propertySearchSchema } from "@/lib/validators/search";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const parsed = propertySearchSchema.safeParse({
      q: searchParams.get("q") ?? "",
      north: searchParams.get("north") ?? undefined,
      south: searchParams.get("south") ?? undefined,
      east: searchParams.get("east") ?? undefined,
      west: searchParams.get("west") ?? undefined,
    });

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid property search request",
        400,
        parsed.error.flatten(),
      );
    }

    const { userId: clerkUserId } = await auth();

    const appUser = clerkUserId
      ? (await getAppUserByClerkUserId(clerkUserId)) ??
        (await syncClerkUserToDb(clerkUserId))
      : null;

    const results = await searchMarketplaceProperties(
      parsed.data,
      appUser?.id ?? null,
    );

    return apiSuccess({
      query: parsed.data.q,
      bounds:
        parsed.data.north !== undefined &&
        parsed.data.south !== undefined &&
        parsed.data.east !== undefined &&
        parsed.data.west !== undefined
          ? {
              north: parsed.data.north,
              south: parsed.data.south,
              east: parsed.data.east,
              west: parsed.data.west,
            }
          : null,
      count: results.length,
      results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
