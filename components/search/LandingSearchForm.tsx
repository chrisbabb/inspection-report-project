"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LandingSearchForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const q = query.trim();
    if (!q) return;

    router.push(`/map?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-8 max-w-2xl">
      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm md:flex-row">
        <input
          className="flex-1 rounded-lg border px-4 py-3"
          placeholder="Search by address, city, or zip"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-lg bg-black px-5 py-3 text-white"
        >
          Search Reports
        </button>
      </div>
    </form>
  );
}