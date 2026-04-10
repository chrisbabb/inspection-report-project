import { NextResponse } from "next/server";

import { requireAppUser } from "@/lib/authz";
import { createReportCheckoutSession } from "@/lib/services/purchases";

type RouteContext = {
  params: Promise<{
    reportId: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  try {
    const authResult = await requireAppUser();

    if (!authResult.ok) {
      return authResult.response;
    }

    const { reportId } = await context.params;

    const session = await createReportCheckoutSession({
      reportId,
      buyerUserId: authResult.appUser.id,
    });

    return NextResponse.json(session);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create purchase checkout";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
