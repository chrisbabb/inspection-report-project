import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPresignedDownloadUrl } from "@/lib/s3";

type RouteContext = {
  params: Promise<{
    reportId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { reportId } = await context.params;

    const user = await db.user.findUnique({
      where: { clerkUserId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const report = await db.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        sellerUserId: true,
        files: {
          orderBy: {
            sortOrder: "asc",
          },
          select: {
            id: true,
            storageKey: true,
            mimeType: true,
            originalFilename: true,
            kind: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const isSeller = report.sellerUserId === user.id;
    const isAdmin = user.role === "ADMIN";

    let hasBuyerAccess = false;

    if (!isSeller && !isAdmin) {
      const access = await db.reportAccess.findUnique({
        where: {
          reportId_buyerUserId: {
            reportId,
            buyerUserId: user.id,
          },
        },
        select: {
          status: true,
        },
      });

      hasBuyerAccess = access?.status === "ACTIVE";
    }

    if (!isSeller && !isAdmin && !hasBuyerAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const primaryFile = report.files[0];

    if (!primaryFile) {
      return NextResponse.json(
        { error: "No report file is available" },
        { status: 404 },
      );
    }

    const url = await createPresignedDownloadUrl({
      key: primaryFile.storageKey,
    });

    return NextResponse.json({
      url,
      mimeType: primaryFile.mimeType,
      filename: primaryFile.originalFilename,
      kind: primaryFile.kind,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate view URL";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}