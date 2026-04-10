
import { NextResponse } from "next/server";

import { requireAppUser } from "@/lib/authz";
import {
  renderAuthorizedReportPageImage,
  ReportViewerAccessError,
} from "@/lib/report-viewer";

type RouteContext = {
  params: Promise<{
    reportId: string;
    pageNumber: string;
  }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, context: RouteContext) {
  const authResult = await requireAppUser();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const { reportId, pageNumber } = await context.params;
    const page = Number.parseInt(pageNumber, 10);

    const rendered = await renderAuthorizedReportPageImage({
      reportId,
      clerkUserId: authResult.userId,
      pageNumber: page,
    });

    return new NextResponse(rendered.body, {
      status: 200,
      headers: {
        "Content-Type": rendered.contentType,
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": 'inline; filename="report-page.png"',
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch (error) {
    if (error instanceof ReportViewerAccessError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: {
            "Cache-Control": "private, no-store, max-age=0",
          },
        },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to render report page";

    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  }
}
