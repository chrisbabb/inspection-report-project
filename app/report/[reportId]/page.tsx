import { notFound } from "next/navigation";
import PublicReportDetailClient from "@/components/reports/PublicReportDetailClient";
import { getPublicReportDetail } from "@/lib/services/reports";

type PageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function ReportDetailPage({ params }: PageProps) {
  const { reportId } = await params;

  const report = await getPublicReportDetail(reportId);

  if (!report) {
    notFound();
  }

  const serializedReport = {
    ...report,
    inspectionDate: report.inspectionDate.toISOString(),
    createdAt: report.createdAt.toISOString(),
    status: "PUBLISHED" as const,
  };

  return <PublicReportDetailClient report={serializedReport} />;
}