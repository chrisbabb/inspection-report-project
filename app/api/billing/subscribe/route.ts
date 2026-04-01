import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSubscriptionCheckoutSession } from "@/lib/services/billing";

type RequestBody = {
  interval?: "monthly" | "annual";
};

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as RequestBody;
    const interval = body.interval;

    if (interval !== "monthly" && interval !== "annual") {
      return NextResponse.json(
        { error: "interval must be monthly or annual" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const session = await createSubscriptionCheckoutSession({
      userId: user.id,
      userEmail: user.email,
      interval,
    });

    return NextResponse.json(session);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create checkout session";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}