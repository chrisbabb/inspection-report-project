import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireAppUser } from "@/lib/authz";
import { getReportOwnership } from "@/lib/services/reports";
import { createReportFileUpload } from "@/lib/services/storage";
import { createReportUploadUrlSchema } from "@/lib/validators/upload";

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
    const parsed = createReportUploadUrlSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid upload request payload",
        400,
        parsed.error.flatten(),
      );
    }

    const upload = await createReportFileUpload({
      sellerUserId: authResult.appUser.id,
      reportId,
      filename: parsed.data.filename,
      contentType: parsed.data.contentType,
    });

    return apiSuccess(
      {
        reportId,
        kind: parsed.data.kind,
        filename: parsed.data.filename,
        contentType: parsed.data.contentType,
        ...upload,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}