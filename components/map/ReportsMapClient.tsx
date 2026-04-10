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
  hasAccess?: boolean;
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
  query?: string;
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

function getAddressComponent(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  type: string,
) {
  return components?.find((component) => component.types.includes(type));
}

function getSearchQueryFromPlace(
  place: google.maps.places.PlaceResult,
  fallback: string,
) {
  const streetNumber = getAddressComponent(place.address_components, "street_number")
    ?.long_name;
  const route = getAddressComponent(place.address_components, "route")?.long_name;
  const city =
    getAddressComponent(place.address_components, "locality")?.long_name ??
    getAddressComponent(place.address_components, "postal_town")?.long_name ??
    getAddressComponent(place.address_components, "sublocality")?.long_name ??
    "";
  const zip = getAddressComponent(place.address_components, "postal_code")?.long_name ?? "";

  if (streetNumber || route) {
    return place.formatted_address?.trim() || fallback.trim();
  }

  if (zip && place.types?.includes("postal_code")) {
    return zip;
  }

  if (city && (place.types?.includes("locality") || place.types?.includes("administrative_area_level_3"))) {
    return city;
  }

  if (zip) {
    return zip;
  }

  if (city) {
    return city;
  }

  if (place.formatted_address?.trim()) {
    return place.formatted_address.trim();
  }

  if (place.name?.trim()) {
    return place.name.trim();
  }

  return fallback.trim();
}

export default function ReportsMapClient({ query }: Props) {
  const router = useRouter();
  const normalizedQuery = typeof query === "string" ? query : "";

  const [searchInput, setSearchInput] = useState(normalizedQuery);
  const [results, setResults] = useState<SearchProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [locationResolved, setLocationResolved] = useState(false);
  const [usingNearbyMode, setUsingNearbyMode] = useState(!normalizedQuery.trim());

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const nearbyRequestIdRef = useRef(0);
  const skipNextIdleFetchRef = useRef(false);
  const hasCenteredOnUserRef = useRef(false);
  const shouldPanToSelectionRef = useRef(false);

  useEffect(() => {
    setSearchInput(normalizedQuery);
    setUsingNearbyMode(!normalizedQuery.trim());
  }, [normalizedQuery]);

  const selectedProperty = useMemo(() => {
    if (!selectedPropertyId) return null;
    return results.find((result) => result.id === selectedPropertyId) ?? null;
  }, [results, selectedPropertyId]);

  function pushSearch(nextValue: string) {
    const q = nextValue.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pushSearch(searchInput);
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
        setSelectedPropertyId(null);
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

          return null;
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
    let mounted = true;
    let autocomplete: google.maps.places.Autocomplete | null = null;
    let listener: google.maps.MapsEventListener | null = null;

    async function initSearchAutocomplete() {
      try {
        ensureMapsConfigured();
        await importLibrary("places");

        if (!mounted || !searchInputRef.current || !window.google?.maps?.places) {
          return;
        }

        autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
          fields: ["name", "formatted_address", "address_components", "types"],
        });

        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete?.getPlace();
          if (!place) return;

          const nextQuery = getSearchQueryFromPlace(
            place,
            searchInputRef.current?.value ?? searchInput,
          );

          if (!nextQuery) return;

          setSearchInput(nextQuery);
          pushSearch(nextQuery);
        });
      } catch {
        // Keep manual search working even if autocomplete fails.
      }
    }

    void initSearchAutocomplete();

    return () => {
      mounted = false;
      if (listener) {
        listener.remove();
      }
    };
  }, [router]);

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
        shouldPanToSelectionRef.current = true;
        setSelectedPropertyId(property.id);

        const firstReport = property.reports[0];
        const content = `
          <div style="max-width:260px;padding:4px 2px;">
            <div style="font-weight:600;margin-bottom:6px;">${property.formattedAddress}</div>
            <div style="font-size:12px;color:#475569;margin-bottom:10px;">
              ${firstReport ? `Latest inspection: ${formatInspectionDate(firstReport.inspectionDate)}` : "No published reports"}
            </div>
            ${
              firstReport
                ? `<a href="/report/${firstReport.id}" style="display:inline-block;padding:8px 12px;border-radius:10px;background:#0284c7;color:#fff;text-decoration:none;font-weight:600;">Purchase</a>`
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

    const card = cardRefs.current[selectedProperty.id];
    if (card) {
      card.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }

    if (!shouldPanToSelectionRef.current) {
      return;
    }

    shouldPanToSelectionRef.current = false;

    const map = mapRef.current;
    if (!map) return;

    skipNextIdleFetchRef.current = true;
    map.panTo({
      lat: selectedProperty.lat,
      lng: selectedProperty.lng,
    });

    const currentZoom = map.getZoom() ?? SEARCH_ZOOM;
    if (currentZoom < SEARCH_ZOOM) {
      map.setZoom(SEARCH_ZOOM);
    }
  }, [selectedProperty]);

  const emptyMessage = normalizedQuery.trim()
    ? "No matching properties were found in the marketplace for this search yet."
    : "Move the map or allow location access to see nearby published inspection reports.";

  return (
    <div className="market-page app-page min-h-[calc(100vh-72px)]">
      <div className="grid h-[calc(100vh-72px)] min-h-[calc(100vh-72px)] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <aside className="market-panel flex min-h-0 flex-col overflow-hidden rounded-3xl app-surface">
          <div className="app-divider border-b p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold">Find Inspection Reports</h1>
                <p className="app-muted mt-1 text-sm">
                  Search by address, city, or zip. Suggestions will appear as you type.
                </p>
              </div>
              <Link
                href="/dashboard/reports"
                className="app-button-primary shrink-0 px-4 py-2 text-sm"
              >
                Upload your report
              </Link>
            </div>

            <form onSubmit={handleSearchSubmit} className="mt-4 space-y-3">
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Enter address, city, or zip"
                className="market-search-input w-full px-4 py-3"
                autoComplete="off"
              />

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="market-search-button px-5 py-3 text-sm"
                >
                  Search
                </button>

                {query.trim() ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      pushSearch("");
                    }}
                    className="app-button-secondary px-5 py-3 text-sm"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </form>

            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-[var(--text)]">
                {normalizedQuery.trim() ? "Search Results" : "Listings in View"}
              </span>
              <span className="app-muted">
                {loading ? "Loading…" : `${results.length} shown`}
              </span>
            </div>

            {!normalizedQuery.trim() ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {locationResolved
                  ? "Showing published reports in the current map area."
                  : "Trying to center the map on your location…"}
              </p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {loading && results.length === 0 ? (
              <div className="app-surface-subtle rounded-2xl p-4 text-sm app-muted">
                Loading results...
              </div>
            ) : results.length === 0 ? (
              <div className="app-surface-subtle space-y-3 rounded-2xl p-4">
                <div className="font-medium">No properties found</div>
                <p className="app-muted text-sm">
                  {emptyMessage}
                </p>
                <Link
                  href="/dashboard/reports"
                  className="market-purchase-button px-4 py-2 text-sm"
                >
                  Upload your report
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((property) => {
                  const isSelected = property.id === selectedPropertyId;

                  return (
                    <div
                      key={property.id}
                      ref={(element) => {
                        cardRefs.current[property.id] = element;
                      }}
                      className={`${isSelected ? "app-surface-selected" : "market-listing-card"} rounded-3xl p-4 transition`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          shouldPanToSelectionRef.current = true;
                          setSelectedPropertyId(property.id);
                        }}
                        className="w-full text-left"
                      >
                        <div className="text-base font-semibold">
                          {property.formattedAddress}
                        </div>
                        <div className="app-muted mt-1 text-sm">
                          {property.city}, {property.state} {property.zip}
                        </div>
                      </button>

                      <div className="mt-4 space-y-3">
                        {property.reports.length > 0 ? (
                          property.reports.map((report) => (
                            <div
                              key={report.id}
                              className="market-report-row rounded-2xl p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium">
                                    {report.title?.trim() || "Inspection Report"}
                                  </div>
                                  <div className="app-muted mt-1 text-xs">
                                    {formatInspectionDate(report.inspectionDate)}
                                  </div>
                                </div>

                                <div className="ml-auto flex items-center gap-3">
                                  {report.hasAccess ? (
                                    <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                                      Owned
                                    </div>
                                  ) : (
                                    <div className="text-sm font-semibold">
                                      {formatPrice(report.priceCents)}
                                    </div>
                                  )}
                                  <Link
                                    href={`/report/${report.id}`}
                                    className="market-purchase-button px-4 py-2 text-sm"
                                  >
                                    {report.hasAccess ? "View Report" : "Purchase"}
                                  </Link>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="market-empty-card rounded-2xl p-3 text-sm">
                            No home inspection reports available for this address.
                          </div>
                        )}
                      </div>

                      <div className="mt-4">
                        <Link
                          href={`/dashboard/reports?propertyId=${property.id}`}
                          className="app-link text-sm font-medium"
                        >
                          Add another report to this property
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="app-surface relative min-h-0 overflow-hidden rounded-3xl">
          <div ref={mapContainerRef} className="h-full min-h-[520px] w-full" />

          {!mapReady && !mapError ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[color:color-mix(in_oklab,var(--surface)_82%,transparent)] text-sm app-muted">
              Loading map...
            </div>
          ) : null}

          {mapError ? (
            <div className="alert-danger absolute left-4 top-4 rounded-2xl px-4 py-3 text-sm shadow-sm">
              {mapError}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
