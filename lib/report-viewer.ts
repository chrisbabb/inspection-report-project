
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { ReportFileKind } from "@prisma/client";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { execFile as execFileCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { db } from "@/lib/db";
import { S3_BUCKET, s3 } from "@/lib/s3";
import { syncClerkUserToDb } from "@/lib/services/users";

const execFile = promisify(execFileCallback);

type AccessErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "BAD_REQUEST";

export class ReportViewerAccessError extends Error {
  code: AccessErrorCode;
  status: number;

  constructor(code: AccessErrorCode, message: string, status: number) {
    super(message);
    this.name = "ReportViewerAccessError";
    this.code = code;
    this.status = status;
  }
}

type AuthorizedReportAsset = {
  reportId: string;
  reportTitle: string;
  propertyAddress: string;
  reportStatus: string;
  file: {
    id: string;
    kind: ReportFileKind;
    storageKey: string;
    mimeType: string;
    originalFilename: string;
    pageCount: number | null;
  };
  viewerUser: {
    id: string;
    email: string;
    role: string;
  };
};

function isTransformableBody(
  value: unknown,
): value is { transformToByteArray: () => Promise<Uint8Array> } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "transformToByteArray" in value &&
      typeof (value as { transformToByteArray?: unknown }).transformToByteArray === "function",
  );
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function getObjectBuffer(key: string): Promise<Buffer> {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error("Report file could not be loaded from storage");
  }

  if (isTransformableBody(response.Body)) {
    return Buffer.from(await response.Body.transformToByteArray());
  }

  return streamToBuffer(response.Body as NodeJS.ReadableStream);
}

function buildWatermarkText(_email: string, _reportId: string) {
  return "Inspectely™";
}

function drawWatermark(
  ctx: any,
  width: number,
  height: number,
  watermarkText: string,
) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const diagonal = Math.sqrt(width * width + height * height);
  ctx.translate(width / 2, height / 2);
  ctx.rotate((-35 * Math.PI) / 180);

  const measuredWidth =
    typeof ctx.measureText === "function"
      ? Math.ceil(ctx.measureText(watermarkText).width)
      : 180;

  const stepX = Math.max(measuredWidth + 220, 520);
  const stepY = 240;

  for (let y = -diagonal; y <= diagonal; y += stepY) {
    const rowOffset = Math.round((y / stepY) % 2 === 0 ? 0 : stepX / 2);
    for (let x = -diagonal; x <= diagonal; x += stepX) {
      ctx.fillText(watermarkText, x + rowOffset, y);
    }
  }

  ctx.restore();
}

async function renderImageAssetToPng(buffer: Buffer, watermarkText: string): Promise<Buffer> {
  const image = await loadImage(buffer);
  const maxWidth = 1800;
  const scale = image.width > maxWidth ? maxWidth / image.width : 1;
  const width = Math.max(Math.round(image.width * scale), 1);
  const height = Math.max(Math.round(image.height * scale), 1);

  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");

  context.drawImage(image, 0, 0, width, height);
  drawWatermark(context, width, height, watermarkText);

  return canvas.toBuffer("image/png");
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "report-viewer-"));

  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function normalizeProcessError(error: unknown, fallbackMessage: string): Error {
  if (error && typeof error === "object") {
    const err = error as {
      code?: string;
      stderr?: string | Buffer;
      stdout?: string | Buffer;
      message?: string;
    };

    if (err.code === "ENOENT") {
      return new Error(
        "Missing Poppler utilities. Install them with: sudo apt update && sudo apt install -y poppler-utils",
      );
    }

    const stderr =
      typeof err.stderr === "string"
        ? err.stderr.trim()
        : Buffer.isBuffer(err.stderr)
          ? err.stderr.toString("utf8").trim()
          : "";

    if (stderr) {
      return new Error(stderr);
    }

    if (err.message) {
      return new Error(err.message);
    }
  }

  return new Error(fallbackMessage);
}

async function getPdfPageCount(buffer: Buffer): Promise<number> {
  return withTempDir(async (dir) => {
    const pdfPath = path.join(dir, "source.pdf");
    await fs.writeFile(pdfPath, buffer);

    try {
      const { stdout } = await execFile("pdfinfo", [pdfPath], {
        maxBuffer: 1024 * 1024,
      });

      const match = stdout.match(/^Pages:\s+(\d+)$/m);
      if (!match) {
        throw new Error("Could not determine PDF page count");
      }

      const pageCount = Number.parseInt(match[1], 10);
      if (!Number.isFinite(pageCount) || pageCount < 1) {
        throw new Error("Invalid PDF page count");
      }

      return pageCount;
    } catch (error) {
      throw normalizeProcessError(error, "Failed to inspect PDF");
    }
  });
}

async function renderPdfPageToPng(
  buffer: Buffer,
  pageNumber: number,
  watermarkText: string,
): Promise<{ png: Buffer; totalPages: number }> {
  return withTempDir(async (dir) => {
    const pdfPath = path.join(dir, "source.pdf");
    const outputBase = path.join(dir, "page");

    await fs.writeFile(pdfPath, buffer);

    const totalPages = await getPdfPageCount(buffer);

    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > totalPages) {
      throw new ReportViewerAccessError("BAD_REQUEST", "Invalid page number", 400);
    }

    try {
      await execFile(
        "pdftocairo",
        [
          "-png",
          "-singlefile",
          "-f",
          String(pageNumber),
          "-l",
          String(pageNumber),
          pdfPath,
          outputBase,
        ],
        {
          maxBuffer: 10 * 1024 * 1024,
        },
      );
    } catch (error) {
      throw normalizeProcessError(error, "Failed to render PDF page");
    }

    const renderedPath = `${outputBase}.png`;
    const rendered = await fs.readFile(renderedPath);
    const png = await renderImageAssetToPng(rendered, watermarkText);

    return { png, totalPages };
  });
}

export async function getAuthorizedReportAsset(
  reportId: string,
  clerkUserId: string,
): Promise<AuthorizedReportAsset> {
  if (!clerkUserId) {
    throw new ReportViewerAccessError("UNAUTHORIZED", "Authentication required", 401);
  }

  const viewerUser = await syncClerkUserToDb(clerkUserId);

  const report = await db.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      title: true,
      status: true,
      sellerUserId: true,
      property: {
        select: {
          formattedAddress: true,
        },
      },
      files: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          kind: true,
          storageKey: true,
          mimeType: true,
          originalFilename: true,
          pageCount: true,
        },
      },
    },
  });

  if (!report || report.status === "REMOVED") {
    throw new ReportViewerAccessError("NOT_FOUND", "Report not found", 404);
  }

  const isSeller = report.sellerUserId === viewerUser.id;
  const isAdmin = viewerUser.role === "ADMIN";

  let hasBuyerAccess = false;
  if (!isSeller && !isAdmin) {
    const access = await db.reportAccess.findUnique({
      where: {
        reportId_buyerUserId: {
          reportId,
          buyerUserId: viewerUser.id,
        },
      },
      select: {
        status: true,
      },
    });

    hasBuyerAccess = access?.status === "ACTIVE";
  }

  if (!isSeller && !isAdmin && !hasBuyerAccess) {
    throw new ReportViewerAccessError("FORBIDDEN", "You do not have access to this report", 403);
  }

  const primaryFile = report.files[0];
  if (!primaryFile) {
    throw new ReportViewerAccessError("NOT_FOUND", "No report file is available", 404);
  }

  return {
    reportId: report.id,
    reportTitle: report.title?.trim() || "Home Inspection Report",
    propertyAddress: report.property.formattedAddress,
    reportStatus: report.status,
    file: primaryFile,
    viewerUser: {
      id: viewerUser.id,
      email: viewerUser.email,
      role: viewerUser.role,
    },
  };
}

export async function getAuthorizedReportViewerContext(
  reportId: string,
  clerkUserId: string,
) {
  const asset = await getAuthorizedReportAsset(reportId, clerkUserId);

  let totalPages = asset.file.pageCount ?? 1;

  if (asset.file.kind === "PDF" && !asset.file.pageCount) {
    const buffer = await getObjectBuffer(asset.file.storageKey);
    totalPages = await getPdfPageCount(buffer);

    await db.reportFile.update({
      where: { id: asset.file.id },
      data: { pageCount: totalPages },
    });
  }

  return {
    reportId: asset.reportId,
    reportTitle: asset.reportTitle,
    propertyAddress: asset.propertyAddress,
    totalPages: Math.max(totalPages, 1),
    watermarkText: buildWatermarkText(asset.viewerUser.email, asset.reportId),
  };
}

export async function renderAuthorizedReportPageImage(params: {
  reportId: string;
  clerkUserId: string;
  pageNumber: number;
}) {
  const asset = await getAuthorizedReportAsset(params.reportId, params.clerkUserId);
  const watermarkText = buildWatermarkText(asset.viewerUser.email, asset.reportId);
  const buffer = await getObjectBuffer(asset.file.storageKey);

  if (asset.file.kind === "PDF") {
    const { png, totalPages } = await renderPdfPageToPng(
      buffer,
      params.pageNumber,
      watermarkText,
    );

    if (!asset.file.pageCount || asset.file.pageCount !== totalPages) {
      await db.reportFile.update({
        where: { id: asset.file.id },
        data: { pageCount: totalPages },
      });
    }

    return {
      body: png,
      contentType: "image/png",
      totalPages,
    };
  }

  if (params.pageNumber !== 1) {
    throw new ReportViewerAccessError("BAD_REQUEST", "Invalid page number", 400);
  }

  const png = await renderImageAssetToPng(buffer, watermarkText);

  return {
    body: png,
    contentType: "image/png",
    totalPages: 1,
  };
}
