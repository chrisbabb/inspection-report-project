import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{
    reportId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentication required", 401);
    }

    const { reportId } = await context.params;

    const report = await db.report.findFirst({
      where: {
        id: reportId,
        status: "PUBLISHED",
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (!report) {
      return apiError("NOT_FOUND", "Published report not found", 404);
    }

    return apiSuccess({
      reportId: report.id,
      status: "checkout_placeholder",
      message:
        "Purchase flow placeholder created. Stripe checkout will be added in the next payment task.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}