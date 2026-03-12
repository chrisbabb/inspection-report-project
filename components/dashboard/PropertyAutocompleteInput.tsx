"use client";

import { useEffect, useRef } from "react";
import { loadPlacesLibrary } from "@/lib/google-maps";

export type SelectedPropertyAddress = {
  placeId: string;
  formattedAddress: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: SelectedPropertyAddress) => void;
};

function getAddressComponent(
  components: google.maps.GeocoderAddressComponent[],
  type: string,
) {
  return components.find((component) => component.types.includes(type));
}

export default function PropertyAutocompleteInput({
  value,
  onChange,
  onSelect,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;
    let autocomplete: google.maps.places.Autocomplete | null = null;
    let listener: google.maps.MapsEventListener | null = null;

    async function init() {
      await loadPlacesLibrary();

      if (!mounted || !inputRef.current || !window.google?.maps?.places) {
        return;
      }

      autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ["place_id", "formatted_address", "address_components", "geometry"],
        types: ["address"],
      });

      listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete?.getPlace();

        if (
          !place ||
          !place.place_id ||
          !place.formatted_address ||
          !place.address_components ||
          !place.geometry?.location
        ) {
          return;
        }

        const streetNumber =
          getAddressComponent(place.address_components, "street_number")?.long_name ?? "";
        const route =
          getAddressComponent(place.address_components, "route")?.long_name ?? "";
        const city =
          getAddressComponent(place.address_components, "locality")?.long_name ??
          getAddressComponent(place.address_components, "sublocality")?.long_name ??
          "";
        const state =
          getAddressComponent(
            place.address_components,
            "administrative_area_level_1",
          )?.short_name ?? "";
        const zip =
          getAddressComponent(place.address_components, "postal_code")?.long_name ?? "";

        const street = [streetNumber, route].filter(Boolean).join(" ").trim();

        const selected: SelectedPropertyAddress = {
          placeId: place.place_id,
          formattedAddress: place.formatted_address,
          street,
          city,
          state,
          zip,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };

        onChange(place.formatted_address);
        onSelect(selected);
      });
    }

    void init();

    return () => {
      mounted = false;
      if (listener) {
        listener.remove();
      }
    };
  }, [onChange, onSelect]);

  return (
    <input
      ref={inputRef}
      className="w-full rounded-lg border px-3 py-2"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Start typing an address..."
      autoComplete="off"
    />
  );
}