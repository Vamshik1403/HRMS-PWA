"use client";

import { useEffect, useRef } from "react";
import { SearchSuggestInput } from "../SearchSuggestInput";
import { Input } from "./input";
import { Label } from "./label";
import {
  fetchCities,
  fetchCountries,
  fetchCurrencies,
  fetchLocationByPincode,
  fetchStates,
} from "../../utils/geoApi";

interface LocationValues {
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  currency?: string;
}

interface LocationFieldsProps {
  values: LocationValues;
  onChange: (patch: Partial<LocationValues>) => void;
  showCurrency?: boolean;
  disabled?: boolean;
  pincodeLabel?: string;
}

export function LocationFields({
  values,
  onChange,
  showCurrency = true,
  disabled = false,
  pincodeLabel = "Pincode",
}: LocationFieldsProps) {
  const pincodeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pincodeLookupGen = useRef(0);

  useEffect(() => {
    return () => {
      if (pincodeTimerRef.current) clearTimeout(pincodeTimerRef.current);
    };
  }, []);

  const handlePincodeChange = (raw: string) => {
    onChange({ pincode: raw });

    if (pincodeTimerRef.current) clearTimeout(pincodeTimerRef.current);

    const code = raw.replace(/\s/g, "");
    if (code.length < 4) return;

    pincodeTimerRef.current = setTimeout(async () => {
      const gen = ++pincodeLookupGen.current;
      const loc = await fetchLocationByPincode(code, values.country || "");
      if (gen !== pincodeLookupGen.current || !loc) return;
      onChange({
        pincode: raw,
        city: loc.city || values.city,
        state: loc.state || values.state,
        country: loc.country || values.country,
      });
    }, 450);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SearchSuggestInput
          label="Country"
          placeholder="Type country name…"
          value={values.country || ""}
          onChange={(v) => onChange({ country: v, state: "", city: "" })}
          onSelect={({ item, display }) =>
            onChange({
              country: display,
              state: "",
              city: "",
              ...(showCurrency && item?.currency && !values.currency
                ? { currency: item.currency }
                : {}),
            })
          }
          fetchData={fetchCountries}
          displayField="name"
          valueField="name"
          disabled={disabled}
        />
        <SearchSuggestInput
          label="State"
          placeholder="Type state name…"
          value={values.state || ""}
          onChange={(v) => onChange({ state: v, city: "" })}
          onSelect={({ display }) => onChange({ state: display, city: "" })}
          fetchData={(q) => fetchStates(values.country || "", q)}
          displayField="name"
          valueField="name"
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SearchSuggestInput
          label="City"
          placeholder="Type city name…"
          value={values.city || ""}
          onChange={(v) => onChange({ city: v })}
          onSelect={({ display }) => onChange({ city: display })}
          fetchData={(q) =>
            fetchCities(values.country || "", values.state || "", q)
          }
          displayField="name"
          valueField="name"
          disabled={disabled}
        />
        <div className="space-y-2">
          <Label>{pincodeLabel}</Label>
          <Input
            value={values.pincode || ""}
            onChange={(e) => handlePincodeChange(e.target.value)}
            placeholder="Enter pincode"
            disabled={disabled}
            autoComplete="postal-code"
          />
        </div>
      </div>

      {showCurrency && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SearchSuggestInput
            label="Currency"
            placeholder="Type currency code…"
            value={values.currency || ""}
            onChange={(v) => onChange({ currency: v })}
            onSelect={({ display }) => onChange({ currency: display })}
            fetchData={fetchCurrencies}
            displayField="code"
            valueField="code"
            disabled={disabled}
          />
        </div>
      )}
    </>
  );
}
