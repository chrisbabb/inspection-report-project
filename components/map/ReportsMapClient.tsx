"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

type SearchReport = {
  id: string;
  inspectionDate: string;
};

type SearchProperty = {
  id: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  reports: SearchReport[];
};

type SearchResponse =
  | {
      ok: true;
      data: {
        results: SearchProperty[];
      };
    }
  | {
      ok: false;
      error: {
        message: string;
      };
    };

type Props = {
  query: string;
};

const DEFAULT_CENTER = { lat: 33.4152, lng: -111.8315 };
let mapsConfigured = false;

function ensureMapsConfigured() {
  if (mapsConfigured) return;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("Google Maps API key missing");
  }

  setOptions({
    key: apiKey,
    v: "weekly",
  });

  mapsConfigured = true;
}

function formatInspectionDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export default function ReportsMapClient({ query }: Props) {
  const router = useRouter();

  const [searchInput, setSearchInput] = useState(query);
  const [results, setResults] = useState<SearchProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  const selectedProperty = useMemo(
    () => results.find((r) => r.id === selectedPropertyId) ?? results[0] ?? null,
    [results, selectedPropertyId],
  );

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = searchInput.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }

  useEffect(() => {
    async function loadResults() {
      if (!query.trim()) {
        setResults([]);
        setSelectedPropertyId(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const response = await fetch(
          `/api/search/properties?q=${encodeURIComponent(query)}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const json: SearchResponse = await response.json();

        if (json.ok) {
          setResults(json.data.results);
          setSelectedPropertyId(json.data.results[0]?.id ?? null);
        } else {
          setResults([]);
          setSelectedPropertyId(null);
        }
      } catch {
        setResults([]);
        setSelectedPropertyId(null);
      } finally {
        setLoading(false);
      }
    }

    void loadResults();
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      try {
        setMapError(null);
        ensureMapsConfigured();
        await importLibrary("maps");

        if (cancelled || !mapContainerRef.current || !window.google?.maps) {
          return;
        }

        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];

        const first = results[0];
        const center = first
          ? { lat: first.lat, lng: first.lng }
          : DEFAULT_CENTER;

        const map = new window.google.maps.Map(mapContainerRef.current, {
          center,
          zoom: results.length ? 13 : 10,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        mapRef.current = map;
        setMapReady(true);

        markersRef.current = results.map((property) => {
          const marker = new window.google.maps.Marker({
            map,
            position: { lat: property.lat, lng: property.lng },
            title: property.formattedAddress,
          });

          marker.addListener("click", () => {
            setSelectedPropertyId(property.id);
          });

          return marker;
        });
      } catch (error) {
        setMapReady(false);
        setMapError(
          error instanceof Error ? error.message : "Failed to load map",
        );
      }
    }

    void initMap();

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [results]);

  useEffect(() => {
    if (!selectedProperty) return;

    const map = mapRef.current;
    if (map) {
      map.panTo({
        lat: selectedProperty.lat,
        lng: selectedProperty.lng,
      });
    }

    const card = cardRefs.current[selectedProperty.id];
    if (card) {
      card.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedProperty]);

  return (
    <main className="flex h-full w-full">
      <aside className="market-panel flex h-full w-[20vw] min-w-[360px] max-w-[460px] flex-col">
        <div className="site-header border-b px-6 py-6 shadow-sm">
          <h1 className="text-xl font-bold">Find Inspection Reports</h1>
          <p className="market-secondary-text mt-1 text-sm">
            Search by address, city, or zip code
          </p>

          <form onSubmit={handleSearchSubmit} className="mt-5 flex items-center">
            <input
              className="market-search-input"
              placeholder="Search address, city, or zip"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className="market-search-button">
              Search
            </button>
          </form>
        </div>

        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-6">
          {loading ? (
            <div className="market-listing-card">
              <p className="market-secondary-text text-sm">Loading results...</p>
            </div>
          ) : !query.trim() ? (
            <div className="market-listing-card">
              <p className="market-secondary-text text-sm">
                Enter an address, city, or zip code to search for available home
                inspection reports.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="market-listing-card">
              <div className="font-semibold">No properties found</div>
              <p className="market-secondary-text mt-2 text-sm">
                No matching properties were found in the marketplace for this
                search yet.
              </p>
              <Link
                href="/dashboard/reports"
                className="market-purchase-button mt-4"
              >
                Add an Inspection Report
              </Link>
            </div>
          ) : (
            <div className="market-listing-stack">
              {results.map((property) => {
                const isSelected = property.id === selectedPropertyId;

                return (
                  <div
                    key={property.id}
                    ref={(el) => {
                      cardRefs.current[property.id] = el;
                    }}
                    className={`market-listing-card ${
                      isSelected ? "market-listing-card-selected" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedPropertyId(property.id)}
                      className="w-full text-left"
                    >
                      <div className="text-[15px] font-bold leading-6">
                        {property.formattedAddress}
                      </div>
                    </button>

                    <div className="mt-5 space-y-3">
                      {property.reports.length > 0 ? (
                        property.reports.map((report) => (
                          <div key={report.id} className="market-report-row">
                            <div className="market-secondary-text text-sm font-medium">
                              {formatInspectionDate(report.inspectionDate)}
                            </div>

                            <Link
                              href={`/report/${report.id}`}
                              className="market-purchase-button"
                            >
                              Purchase Report
                            </Link>
                          </div>
                        ))
                      ) : (
                        <div className="market-empty-card">
                          <div className="market-secondary-text text-sm">
                            No inspection reports available
                          </div>
                          <Link
                            href="/dashboard/reports"
                            className="market-purchase-button mt-4"
                          >
                            Add One
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <section className="relative h-full w-[80vw] flex-1 bg-slate-200">
        <div ref={mapContainerRef} className="h-full w-full" />

        {!mapReady && !mapError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-sm text-gray-600">
            Loading map...
          </div>
        ) : null}

        {mapError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50 p-6 text-center text-sm text-red-700">
            {mapError}
          </div>
        ) : null}
      </section>
    </main>
  );
}