import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireAppUser } from "@/lib/authz";
import {
  getReportOwnership,
  registerReportFile,
} from "@/lib/services/reports";
import { reportFileCreateSchema } from "@/lib/validators/report";

type RouteContext = {
  params: Promise<{
    reportId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAppUser();

    if (!authResult.ok) {
      return authResult.response;
    }

    const { reportId } = await context.params;

    const report = await getReportOwnership(reportId);

    if (!report) {
      return apiError("NOT_FOUND", "Report not found", 404);
    }

    if (report.sellerUserId !== authResult.appUser.id) {
      return apiError("FORBIDDEN", "You do not own this report", 403);
    }

    const body = await request.json();
    const parsed = reportFileCreateSchema.safeParse({
      ...body,
      reportId,
    });

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid report file payload",
        400,
        parsed.error.flatten(),
      );
    }

    const file = await registerReportFile(parsed.data);

    return apiSuccess(file, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}