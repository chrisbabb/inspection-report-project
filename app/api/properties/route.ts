import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireAppUser } from "@/lib/authz";
import { upsertProperty } from "@/lib/services/properties";
import { propertyUpsertSchema } from "@/lib/validators/property";

export async function POST(request: Request) {
  try {
    const authResult = await requireAppUser();

    if (!authResult.ok) {
      return authResult.response;
    }

    const body = await request.json();
    const parsed = propertyUpsertSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid property payload",
        400,
        parsed.error.flatten(),
      );
    }

    const property = await upsertProperty(parsed.data);

    return apiSuccess(property, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}