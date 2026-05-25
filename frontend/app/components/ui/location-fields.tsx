"use client";

import { SearchSuggestInput } from "../SearchSuggestInput";
import { Input } from "./input";
import { Label } from "./label";
import { fetchCities, fetchCountries, fetchCurrencies, fetchStates } from "../../utils/geoApi";

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
}

export function LocationFields({ values, onChange, showCurrency = true }: LocationFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SearchSuggestInput
          label="City"
          placeholder="Type city name…"
          value={values.city || ""}
          onChange={(v) => onChange({ city: v })}
          onSelect={({ display }) => onChange({ city: display })}
          fetchData={(q) => fetchCities(values.country || "", values.state || "", q)}
          displayField="name"
          valueField="name"
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
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Pincode</Label>
          <Input
            value={values.pincode || ""}
            onChange={(e) => onChange({ pincode: e.target.value })}
            placeholder="Enter pincode"
          />
        </div>
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
              ...(item?.currency && !values.currency ? { currency: item.currency } : {}),
            })
          }
          fetchData={fetchCountries}
          displayField="name"
          valueField="name"
        />
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
          />
        </div>
      )}
    </>
  );
}
