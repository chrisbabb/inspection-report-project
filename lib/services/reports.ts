import { db } from "@/lib/db";
import { DEFAULT_REPORT_PURCHASE_PRICE_CENTS } from "@/lib/constants/app";
import type {
  ReportCreateInput,
  ReportFileCreateInput,
  ReportUpdateInput,
} from "@/lib/validators/report";

export async function createDraftReport(input: ReportCreateInput, sellerUserId: string) {
  return db.report.create({
    data: {
      propertyId: input.propertyId,
      sellerUserId,
      inspectionDate: input.inspectionDate,
      title: input.title,
      status: "DRAFT",
      extractionStatus: "PENDING",
    },
    select: {
      id: true,
      propertyId: true,
      sellerUserId: true,
      inspectionDate: true,
      title: true,
      priceCents: true,
      status: true,
      extractionStatus: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getReportById(reportId: string) {
  return db.report.findUnique({
    where: { id: reportId },
    include: {
      property: {
        select: {
          id: true,
          placeId: true,
          formattedAddress: true,
          city: true,
          state: true,
          zip: true,
          lat: true,
          lng: true,
        },
      },
      seller: {
        select: {
          id: true,
          name: true,
        },
      },
      files: {
        orderBy: {
          sortOrder: "asc",
        },
        select: {
          id: true,
          kind: true,
          originalFilename: true,
          mimeType: true,
          sizeBytes: true,
          sortOrder: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function getReportOwnership(reportId: string) {
  return db.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      sellerUserId: true,
      status: true,
    },
  });
}

export async function registerReportFile(input: ReportFileCreateInput) {
  return db.reportFile.create({
    data: {
      reportId: input.reportId,
      kind: input.kind,
      storageKey: input.storageKey,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      sortOrder: input.sortOrder ?? 0,
      pageCount: input.pageCount,
    },
    select: {
      id: true,
      reportId: true,
      kind: true,
      storageKey: true,
      originalFilename: true,
      mimeType: true,
      sizeBytes: true,
      sortOrder: true,
      pageCount: true,
      createdAt: true,
    },
  });
}

export async function getSellerReports(sellerUserId: string) {
  return db.report.findMany({
    where: {
      sellerUserId,
      status: {
        not: "REMOVED",
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      inspectionDate: true,
      title: true,
      summary: true,
      priceCents: true,
      status: true,
      extractionStatus: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      property: {
        select: {
          id: true,
          formattedAddress: true,
          city: true,
          state: true,
          zip: true,
        },
      },
      files: {
        orderBy: {
          sortOrder: "asc",
        },
        select: {
          id: true,
          kind: true,
          originalFilename: true,
          mimeType: true,
          sizeBytes: true,
          sortOrder: true,
        },
      },
    },
  });
}

export async function updateSellerReport(
  reportId: string,
  sellerUserId: string,
  input: ReportUpdateInput,
) {
  const existing = await db.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      sellerUserId: true,
      status: true,
    },
  });

  if (!existing) {
    return null;
  }

  if (existing.sellerUserId !== sellerUserId) {
    throw new Error("FORBIDDEN");
  }

  const nextStatus = input.status ?? existing.status;
  const shouldPublish = nextStatus === "PUBLISHED";
  const shouldRemove = nextStatus === "REMOVED";

  return db.report.update({
    where: { id: reportId },
    data: {
      inspectionDate: input.inspectionDate,
      title: input.title === undefined ? undefined : input.title,
      summary: input.summary === undefined ? undefined : input.summary,
      status: input.status,
      publishedAt:
        input.status === undefined
          ? undefined
          : shouldPublish
            ? new Date()
            : null,
      removedAt:
        input.status === undefined
          ? undefined
          : shouldRemove
            ? new Date()
            : null,
    },
    select: {
      id: true,
      propertyId: true,
      sellerUserId: true,
      inspectionDate: true,
      title: true,
      summary: true,
      priceCents: true,
      status: true,
      extractionStatus: true,
      publishedAt: true,
      removedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function softDeleteSellerReport(reportId: string, sellerUserId: string) {
  const existing = await db.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      sellerUserId: true,
    },
  });

  if (!existing) {
    return null;
  }

  if (existing.sellerUserId !== sellerUserId) {
    throw new Error("FORBIDDEN");
  }

  return db.report.update({
    where: { id: reportId },
    data: {
      status: "REMOVED",
      removedAt: new Date(),
    },
    select: {
      id: true,
      status: true,
      removedAt: true,
      updatedAt: true,
    },
  });
}