"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

type SearchReport = {
  id: string;
  title?: string | null;
  summary?: string | null;
  inspectionDate: string;
  priceCents?: number;
};

type SearchProperty = {
  id: string;
  formattedAddress: string;
  street: string;
  city: string;
  state: string;
  zip: string;
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

type BoundsPayload = {
  north: number;
  south: number;
  east: number;
  west: number;
};

const DEFAULT_CENTER = { lat: 33.4484, lng: -112.074 };
const DEFAULT_ZOOM = 11;
const SEARCH_ZOOM = 13;

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

function formatPrice(value?: number) {
  if (typeof value !== "number") return "$50";
  return `$${(value / 100).toFixed(0)}`;
}

function serializeBounds(bounds: BoundsPayload) {
  const params = new URLSearchParams({
    north: String(bounds.north),
    south: String(bounds.south),
    east: String(bounds.east),
    west: String(bounds.west),
  });

  return params.toString();
}

export default function ReportsMapClient({ query }: Props) {
  const router = useRouter();

  const [searchInput, setSearchInput] = useState(query);
  const [results, setResults] = useState<SearchProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [locationResolved, setLocationResolved] = useState(false);
  const [usingNearbyMode, setUsingNearbyMode] = useState(!query.trim());

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const nearbyRequestIdRef = useRef(0);
  const skipNextIdleFetchRef = useRef(false);
  const hasCenteredOnUserRef = useRef(false);

  useEffect(() => {
    setSearchInput(query);
    setUsingNearbyMode(!query.trim());
  }, [query]);

  const selectedProperty = useMemo(
    () => results.find((r) => r.id === selectedPropertyId) ?? results[0] ?? null,
    [results, selectedPropertyId],
  );

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    const q = searchInput.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }

  async function fetchByQuery(searchQuery: string) {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/search/properties?q=${encodeURIComponent(searchQuery)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const json = (await response.json()) as SearchResponse;

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

  async function fetchByBounds(bounds: BoundsPayload) {
    const requestId = ++nearbyRequestIdRef.current;
    setLoading(true);

    try {
      const response = await fetch(
        `/api/search/properties?${serializeBounds(bounds)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const json = (await response.json()) as SearchResponse;

      if (requestId !== nearbyRequestIdRef.current) {
        return;
      }

      if (json.ok) {
        setResults(json.data.results);
        setSelectedPropertyId((current) => {
          if (current && json.data.results.some((item) => item.id === current)) {
            return current;
          }

          return json.data.results[0]?.id ?? null;
        });
      } else {
        setResults([]);
        setSelectedPropertyId(null);
      }
    } catch {
      if (requestId !== nearbyRequestIdRef.current) {
        return;
      }

      setResults([]);
      setSelectedPropertyId(null);
    } finally {
      if (requestId === nearbyRequestIdRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    async function loadSearchResults() {
      if (!query.trim()) {
        setUsingNearbyMode(true);
        return;
      }

      setUsingNearbyMode(false);
      await fetchByQuery(query.trim());
    }

    void loadSearchResults();
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      try {
        setMapError(null);
        ensureMapsConfigured();
        await importLibrary("maps");
        await importLibrary("marker");

        if (cancelled || !mapContainerRef.current || !window.google?.maps) {
          return;
        }

        const map = new window.google.maps.Map(mapContainerRef.current, {
          center: DEFAULT_CENTER,
          zoom: query.trim() ? SEARCH_ZOOM : DEFAULT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });

        const infoWindow = new window.google.maps.InfoWindow();

        mapRef.current = map;
        infoWindowRef.current = infoWindow;
        setMapReady(true);

        map.addListener("idle", () => {
          if (!mapRef.current) return;
          if (!usingNearbyMode) return;
          if (skipNextIdleFetchRef.current) {
            skipNextIdleFetchRef.current = false;
            return;
          }

          const bounds = mapRef.current.getBounds();
          if (!bounds) return;

          const northEast = bounds.getNorthEast();
          const southWest = bounds.getSouthWest();

          void fetchByBounds({
            north: northEast.lat(),
            south: southWest.lat(),
            east: northEast.lng(),
            west: southWest.lng(),
          });
        });

        if (!query.trim() && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              if (cancelled || !mapRef.current || hasCenteredOnUserRef.current) {
                return;
              }

              hasCenteredOnUserRef.current = true;
              setLocationResolved(true);

              mapRef.current.setCenter({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              });
              mapRef.current.setZoom(13);
            },
            () => {
              if (cancelled) return;
              setLocationResolved(true);
            },
            {
              enableHighAccuracy: true,
              timeout: 8000,
              maximumAge: 60000,
            },
          );
        } else {
          setLocationResolved(true);
        }
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

      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
    };
  }, [query, usingNearbyMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const infoWindow = infoWindowRef.current ?? new window.google.maps.InfoWindow();
    infoWindowRef.current = infoWindow;

    markersRef.current = results.map((property) => {
      const marker = new window.google.maps.Marker({
        map,
        position: { lat: property.lat, lng: property.lng },
        title: property.formattedAddress,
      });

      marker.addListener("click", () => {
        setSelectedPropertyId(property.id);

        const firstReport = property.reports[0];
        const content = `
          <div style="max-width:240px;padding:4px 2px;">
            <div style="font-weight:600;margin-bottom:6px;">${property.formattedAddress}</div>
            <div style="font-size:12px;color:#475569;margin-bottom:8px;">
              ${firstReport ? `Latest inspection: ${formatInspectionDate(firstReport.inspectionDate)}` : "No published reports"}
            </div>
            ${
              firstReport
                ? `<a href="/report/${firstReport.id}" style="display:inline-block;padding:8px 12px;border-radius:10px;background:#0284c7;color:#fff;text-decoration:none;font-weight:600;">View Listing</a>`
                : ""
            }
          </div>
        `;

        infoWindow.setContent(content);
        infoWindow.open({
          map,
          anchor: marker,
        });
      });

      return marker;
    });

    if (query.trim() && results.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();

      for (const property of results) {
        bounds.extend({ lat: property.lat, lng: property.lng });
      }

      skipNextIdleFetchRef.current = true;
      map.fitBounds(bounds);

      if (results.length === 1) {
        map.setZoom(SEARCH_ZOOM);
      }
    }
  }, [results, query]);

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

  const emptyMessage = query.trim()
    ? "No matching properties were found in the marketplace for this search yet."
    : "Move the map or allow location access to see nearby inspection reports.";

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex h-[calc(100vh-72px)] flex-col px-4 py-4 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Find Inspection Reports
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Search by address, city, or zip code, or browse listings directly on the map.
            </p>
          </div>

          {!query.trim() ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {locationResolved
                ? "Showing published reports in the current map area."
                : "Trying to center the map on your location…"}
            </div>
          ) : null}
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="mb-4 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row"
        >
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Enter address, city, or zip"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900/30"
          />

          <div className="flex gap-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Search
            </button>

            {query.trim() ? (
              <button
                type="button"
                onClick={() => router.push("/")}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Clear
              </button>
            ) : null}
          </div>
        </form>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="min-h-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">
                  {query.trim() ? "Search Results" : "Listings in View"}
                </h2>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {loading ? "Loading…" : `${results.length} shown`}
                </span>
              </div>
            </div>

            <div className="h-full overflow-y-auto p-4">
              {loading && results.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  Loading results...
                </div>
              ) : results.length === 0 ? (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <div className="font-medium">No properties found</div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {emptyMessage}
                  </p>
                  <Link
                    href="/dashboard/reports"
                    className="inline-flex rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                  >
                    Add an Inspection Report
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {results.map((property) => {
                    const isSelected = property.id === selectedPropertyId;

                    return (
                      <div
                        key={property.id}
                        ref={(el) => {
                          cardRefs.current[property.id] = el;
                        }}
                        className={`rounded-3xl border p-4 transition ${
                          isSelected
                            ? "border-sky-400 bg-sky-50 shadow-sm dark:border-sky-500 dark:bg-sky-950/30"
                            : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedPropertyId(property.id)}
                          className="w-full text-left"
                        >
                          <div className="text-base font-semibold">
                            {property.formattedAddress}
                          </div>
                          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {property.city}, {property.state} {property.zip}
                          </div>
                        </button>

                        <div className="mt-4 space-y-3">
                          {property.reports.length > 0 ? (
                            property.reports.map((report) => (
                              <div
                                key={report.id}
                                className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-medium">
                                      {report.title?.trim() || "Inspection Report"}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                      {formatInspectionDate(report.inspectionDate)}
                                    </div>
                                  </div>

                                  <div className="text-sm font-semibold">
                                    {formatPrice(report.priceCents)}
                                  </div>
                                </div>

                                <div className="mt-3">
                                  <Link
                                    href={`/report/${report.id}`}
                                    className="inline-flex rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                                  >
                                    View Listing
                                  </Link>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                              No inspection reports available yet.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="relative min-h-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div ref={mapContainerRef} className="h-full min-h-[520px] w-full" />

            {!mapReady && !mapError ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/80 text-sm text-slate-500 dark:bg-slate-950/80 dark:text-slate-400">
                Loading map...
              </div>
            ) : null}

            {mapError ? (
              <div className="absolute left-4 top-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {mapError}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}