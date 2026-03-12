/*
  Warnings:

  - A unique constraint covering the columns `[clerkUserId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeCustomerId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeConnectAccountId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clerkUserId` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'PROCESSING', 'PUBLISHED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'REFUNDED', 'DISPUTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportFileKind" AS ENUM ('PDF', 'IMAGE');

-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clerkUserId" TEXT NOT NULL,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER',
ADD COLUMN     "stripeConnectAccountId" TEXT,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "subscriptionPlan" TEXT,
ADD COLUMN     "subscriptionStatus" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "formattedAddress" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "priceCents" INTEGER NOT NULL DEFAULT 5000,
    "title" TEXT,
    "summary" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportFile" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "kind" "ReportFileKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "sellerPayoutCents" INTEGER NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportAccess" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "status" "AccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyViewEvent" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "viewerUserId" TEXT,
    "anonSessionId" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyViewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportViewEvent" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "viewerUserId" TEXT,
    "anonSessionId" TEXT,
    "viewType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportViewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsDailyRollup" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "propertyId" TEXT,
    "reportId" TEXT,
    "propertyViews" INTEGER NOT NULL DEFAULT 0,
    "reportViews" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "grossRevenueCents" INTEGER NOT NULL DEFAULT 0,
    "sellerRevenueCents" INTEGER NOT NULL DEFAULT 0,
    "platformRevenueCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsDailyRollup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "description" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Property_placeId_key" ON "Property"("placeId");

-- CreateIndex
CREATE INDEX "Property_zip_idx" ON "Property"("zip");

-- CreateIndex
CREATE INDEX "Property_city_state_idx" ON "Property"("city", "state");

-- CreateIndex
CREATE INDEX "Property_lat_idx" ON "Property"("lat");

-- CreateIndex
CREATE INDEX "Property_lng_idx" ON "Property"("lng");

-- CreateIndex
CREATE INDEX "Property_createdAt_idx" ON "Property"("createdAt");

-- CreateIndex
CREATE INDEX "Report_propertyId_inspectionDate_idx" ON "Report"("propertyId", "inspectionDate" DESC);

-- CreateIndex
CREATE INDEX "Report_sellerUserId_createdAt_idx" ON "Report"("sellerUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_extractionStatus_idx" ON "Report"("extractionStatus");

-- CreateIndex
CREATE INDEX "Report_publishedAt_idx" ON "Report"("publishedAt");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportFile_storageKey_key" ON "ReportFile"("storageKey");

-- CreateIndex
CREATE INDEX "ReportFile_reportId_sortOrder_idx" ON "ReportFile"("reportId", "sortOrder");

-- CreateIndex
CREATE INDEX "ReportFile_kind_idx" ON "ReportFile"("kind");

-- CreateIndex
CREATE INDEX "ReportFile_createdAt_idx" ON "ReportFile"("createdAt");

-- CreateIndex
CREATE INDEX "Purchase_buyerUserId_createdAt_idx" ON "Purchase"("buyerUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Purchase_reportId_createdAt_idx" ON "Purchase"("reportId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Purchase_status_idx" ON "Purchase"("status");

-- CreateIndex
CREATE INDEX "Purchase_purchasedAt_idx" ON "Purchase"("purchasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportAccess_purchaseId_key" ON "ReportAccess"("purchaseId");

-- CreateIndex
CREATE INDEX "ReportAccess_buyerUserId_grantedAt_idx" ON "ReportAccess"("buyerUserId", "grantedAt" DESC);

-- CreateIndex
CREATE INDEX "ReportAccess_status_idx" ON "ReportAccess"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReportAccess_reportId_buyerUserId_key" ON "ReportAccess"("reportId", "buyerUserId");

-- CreateIndex
CREATE INDEX "PropertyViewEvent_propertyId_createdAt_idx" ON "PropertyViewEvent"("propertyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PropertyViewEvent_viewerUserId_createdAt_idx" ON "PropertyViewEvent"("viewerUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PropertyViewEvent_anonSessionId_idx" ON "PropertyViewEvent"("anonSessionId");

-- CreateIndex
CREATE INDEX "PropertyViewEvent_createdAt_idx" ON "PropertyViewEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ReportViewEvent_reportId_createdAt_idx" ON "ReportViewEvent"("reportId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReportViewEvent_viewerUserId_createdAt_idx" ON "ReportViewEvent"("viewerUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReportViewEvent_anonSessionId_idx" ON "ReportViewEvent"("anonSessionId");

-- CreateIndex
CREATE INDEX "ReportViewEvent_createdAt_idx" ON "ReportViewEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsDailyRollup_sellerUserId_date_idx" ON "AnalyticsDailyRollup"("sellerUserId", "date" DESC);

-- CreateIndex
CREATE INDEX "AnalyticsDailyRollup_propertyId_idx" ON "AnalyticsDailyRollup"("propertyId");

-- CreateIndex
CREATE INDEX "AnalyticsDailyRollup_reportId_idx" ON "AnalyticsDailyRollup"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsDailyRollup_date_sellerUserId_reportId_key" ON "AnalyticsDailyRollup"("date", "sellerUserId", "reportId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");

-- CreateIndex
CREATE INDEX "AppSetting_createdAt_idx" ON "AppSetting"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeConnectAccountId_key" ON "User"("stripeConnectAccountId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportFile" ADD CONSTRAINT "ReportFile_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAccess" ADD CONSTRAINT "ReportAccess_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAccess" ADD CONSTRAINT "ReportAccess_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAccess" ADD CONSTRAINT "ReportAccess_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyViewEvent" ADD CONSTRAINT "PropertyViewEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyViewEvent" ADD CONSTRAINT "PropertyViewEvent_viewerUserId_fkey" FOREIGN KEY ("viewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportViewEvent" ADD CONSTRAINT "ReportViewEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportViewEvent" ADD CONSTRAINT "ReportViewEvent_viewerUserId_fkey" FOREIGN KEY ("viewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsDailyRollup" ADD CONSTRAINT "AnalyticsDailyRollup_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsDailyRollup" ADD CONSTRAINT "AnalyticsDailyRollup_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsDailyRollup" ADD CONSTRAINT "AnalyticsDailyRollup_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSetting" ADD CONSTRAINT "AppSetting_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
