import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { searchMarketplaceProperties } from "@/lib/services/search";
import { propertySearchSchema } from "@/lib/validators/search";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const parsed = propertySearchSchema.safeParse({
      q: searchParams.get("q") ?? "",
    });

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid search query",
        400,
        parsed.error.flatten(),
      );
    }

    const results = await searchMarketplaceProperties(parsed.data.q);

    return apiSuccess({
      query: parsed.data.q,
      count: results.length,
      results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}