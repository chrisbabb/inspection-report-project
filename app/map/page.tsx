import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function MapPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  redirect(query ? `/?q=${encodeURIComponent(query)}` : "/");
}