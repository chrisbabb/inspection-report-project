import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let isConfigured = false;

function ensureGoogleMapsConfigured() {
  if (isConfigured) return;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing");
  }

  setOptions({
    key: apiKey,
    v: "weekly",
  });

  isConfigured = true;
}

export async function loadPlacesLibrary() {
  ensureGoogleMapsConfigured();
  await importLibrary("places");
}