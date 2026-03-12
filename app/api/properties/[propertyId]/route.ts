import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { getPropertyById } from "@/lib/services/properties";

type RouteContext = {
  params: Promise<{
    propertyId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { propertyId } = await context.params;

    const property = await getPropertyById(propertyId);

    if (!property) {
      return apiError("NOT_FOUND", "Property not found", 404);
    }

    return apiSuccess(property);
  } catch (error) {
    return handleApiError(error);
  }
}