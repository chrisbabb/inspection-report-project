import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    reportId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { reportId } = await context.params;

  return NextResponse.json(
    {
      error: "Direct file access is disabled for protected reports. Use the viewer page instead.",
      viewerPath: `/report/${reportId}/view`,
    },
    { status: 410 },
  );
}
