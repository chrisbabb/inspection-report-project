import ReportsMapClient from "@/components/map/ReportsMapClient";

type PageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  return <ReportsMapClient query={query} />;
}