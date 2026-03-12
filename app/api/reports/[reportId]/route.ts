import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireAppUser } from "@/lib/authz";
import {
  getReportById,
  softDeleteSellerReport,
  updateSellerReport,
} from "@/lib/services/reports";
import { reportUpdateSchema } from "@/lib/validators/report";

type RouteContext = {
  params: Promise<{
    reportId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { reportId } = await context.params;

    const report = await getReportById(reportId);

    if (!report) {
      return apiError("NOT_FOUND", "Report not found", 404);
    }

    return apiSuccess(report);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAppUser();

    if (!authResult.ok) {
      return authResult.response;
    }

    const { reportId } = await context.params;

    const body = await request.json();
    const parsed = reportUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid report update payload",
        400,
        parsed.error.flatten(),
      );
    }

    try {
      const updated = await updateSellerReport(
        reportId,
        authResult.appUser.id,
        parsed.data,
      );

      if (!updated) {
        return apiError("NOT_FOUND", "Report not found", 404);
      }

      return apiSuccess(updated);
    } catch (error) {
      if (error instanceof Error && error.message === "FORBIDDEN") {
        return apiError("FORBIDDEN", "You do not own this report", 403);
      }

      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const authResult = await requireAppUser();

    if (!authResult.ok) {
      return authResult.response;
    }

    const { reportId } = await context.params;

    try {
      const deleted = await softDeleteSellerReport(
        reportId,
        authResult.appUser.id,
      );

      if (!deleted) {
        return apiError("NOT_FOUND", "Report not found", 404);
      }

      return apiSuccess(deleted);
    } catch (error) {
      if (error instanceof Error && error.message === "FORBIDDEN") {
        return apiError("FORBIDDEN", "You do not own this report", 403);
      }

      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}