import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireAppUser } from "@/lib/authz";
import { createDraftReport } from "@/lib/services/reports";
import { reportCreateSchema } from "@/lib/validators/report";

function hasActiveSellerSubscription(status: string | null | undefined) {
  const normalized = status?.toLowerCase();
  return normalized === "active" || normalized === "trialing";
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAppUser();

    if (!authResult.ok) {
      return authResult.response;
    }

    if (!hasActiveSellerSubscription(authResult.appUser.subscriptionStatus)) {
      return apiError(
        "FORBIDDEN",
        "An active subscription is required to add a report",
        403,
      );
    }

    const body = await request.json();
    const parsed = reportCreateSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid report payload",
        400,
        parsed.error.flatten(),
      );
    }

    const property = await db.property.findUnique({
      where: {
        id: parsed.data.propertyId,
      },
      select: {
        id: true,
      },
    });

    if (!property) {
      return apiError("NOT_FOUND", "Property not found", 404);
    }

    const report = await createDraftReport(parsed.data, authResult.appUser.id);

    return apiSuccess(report, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
