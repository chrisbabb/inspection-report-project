import ReportsMapClient from "@/components/map/ReportsMapClient";

type HomePageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";

  return <ReportsMapClient query={query} />;
}
