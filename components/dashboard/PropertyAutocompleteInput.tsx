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
  onInputChange: (value: string) => void;
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
  onInputChange,
  onSelect,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ignoreNextInputEventRef = useRef(false);

  useEffect(() => {
    if (!inputRef.current) return;

    if (inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  useEffect(() => {
    let mounted = true;
    let autocomplete: google.maps.places.Autocomplete | null = null;
    let placeChangedListener: google.maps.MapsEventListener | null = null;
    let nativeInputListener: ((event: Event) => void) | null = null;

    async function init() {
      await loadPlacesLibrary();

      if (!mounted || !inputRef.current || !window.google?.maps?.places) {
        return;
      }

      const input = inputRef.current;

      nativeInputListener = () => {
        if (ignoreNextInputEventRef.current) {
          ignoreNextInputEventRef.current = false;
          return;
        }

        onInputChange(input.value);
      };

      input.addEventListener("input", nativeInputListener);

      autocomplete = new window.google.maps.places.Autocomplete(input, {
        fields: ["place_id", "formatted_address", "address_components", "geometry"],
        types: ["address"],
      });

      placeChangedListener = autocomplete.addListener("place_changed", () => {
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

        ignoreNextInputEventRef.current = true;
        input.value = place.formatted_address;

        onSelect(selected);
      });
    }

    void init();

    return () => {
      mounted = false;

      if (placeChangedListener) {
        placeChangedListener.remove();
      }

      if (nativeInputListener && inputRef.current) {
        inputRef.current.removeEventListener("input", nativeInputListener);
      }
    };
  }, [onInputChange, onSelect]);

  return (
    <input
      ref={inputRef}
      className="dashboard-input"
      placeholder="Start typing an address..."
      autoComplete="off"
    />
  );
}
