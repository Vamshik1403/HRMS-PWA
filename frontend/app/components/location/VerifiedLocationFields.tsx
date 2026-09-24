"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { authHeaders } from "@/lib/auth";
import { fetchGPSOnUserGesture } from "../../utils/empGeolocation";

type PinMapProps = {
  latitude: number;
  longitude: number;
  focus: number;
  onMove: (latitude: number, longitude: number) => void;
};

function ClientPinMap(props: PinMapProps) {
  const [Map, setMap] = useState<ComponentType<PinMapProps> | null>(null);
  useEffect(() => {
    let cancelled = false;
    import("./VerifiedPinMap").then((mod) => {
      if (!cancelled) setMap(() => mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!Map) return <div className="h-[220px] rounded-xl bg-gray-50" />;
  return <Map {...props} />;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export type LocationFeature = "branch" | "wfh" | "site";

export type VerifiedLocationValue = {
  address: string;
  latitude: string;
  longitude: string;
  placeId: string;
  locationSource: string;
  locationVerified: boolean;
};

type Suggestion = { placeId: string; label: string };

function num(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function newSessionToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const rand = Math.floor(Math.random() * 16);
    const value = ch === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function pairKey(lat: unknown, lng: unknown) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return "";
  return `${la.toFixed(6)},${ln.toFixed(6)}`;
}

function apiMessage(body: any, fallback: string) {
  const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

export function VerifiedLocationFields({
  feature,
  label,
  address,
  latitude,
  longitude,
  placeId,
  required,
  disabled,
  onChange,
}: {
  feature: LocationFeature;
  label: string;
  address: string;
  latitude: string;
  longitude: string;
  placeId?: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (patch: Partial<VerifiedLocationValue>) => void;
}) {
  const [query, setQuery] = useState(address || "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [focus, setFocus] = useState(0);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [lookupBlocked, setLookupBlocked] = useState(false);
  const skipLookup = useRef((address || "").trim());
  const lastAutocomplete = useRef("");
  const autocompleteAbort = useRef<AbortController | null>(null);
  const sessionToken = useRef(newSessionToken());
  const queryRef = useRef(query);
  const lastReverse = useRef("");
  const latRef = useRef(latitude);
  const lngRef = useRef(longitude);
  queryRef.current = query;
  latRef.current = latitude;
  lngRef.current = longitude;

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/google-maps/status?feature=${feature}`, { headers: authHeaders() })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        return { ok: res.ok, body };
      })
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (ok) {
          setLookupBlocked(false);
          setConfigured(body?.configured === true);
          setError("");
          return;
        }
        setLookupBlocked(true);
        setConfigured(null);
        setError(apiMessage(body, "Location lookup is not available."));
      })
      .catch(() => {
        if (!cancelled) {
          setLookupBlocked(true);
          setConfigured(null);
          setError("Could not check Google address search.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [feature]);

  useEffect(() => {
    const next = address || "";
    if (next === queryRef.current) return;
    queryRef.current = next;
    setQuery(next);
    skipLookup.current = next.trim();
  }, [address]);

  useEffect(() => {
    if (disabled || configured !== true || lookupBlocked) return;
    const q = query.trim();
    if (q.length < 3 || q === skipLookup.current) {
      setSuggestions([]);
      return;
    }
    if (q === lastAutocomplete.current) return;
    const timer = window.setTimeout(async () => {
      autocompleteAbort.current?.abort();
      const ctrl = new AbortController();
      autocompleteAbort.current = ctrl;
      try {
        const res = await fetch(
          `${BACKEND}/google-maps/autocomplete?feature=${feature}&q=${encodeURIComponent(q)}&sessionToken=${encodeURIComponent(sessionToken.current)}`,
          { headers: authHeaders(), signal: ctrl.signal },
        );
        const body = await res.json().catch(() => null);
        if (ctrl.signal.aborted) return;
        if (!res.ok) {
          setSuggestions([]);
          setError(apiMessage(body, "Could not search this address"));
          return;
        }
        lastAutocomplete.current = q;
        setSuggestions(Array.isArray(body) ? body : []);
        setOpen(true);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setSuggestions([]);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      autocompleteAbort.current?.abort();
    };
  }, [query, feature, disabled, configured, lookupBlocked]);

  const lat = num(latitude);
  const lng = num(longitude);

  async function choose(row: Suggestion) {
    setBusy(true);
    setError("");
    setOpen(false);
    try {
      const res = await fetch(
        `${BACKEND}/google-maps/place?feature=${feature}&placeId=${encodeURIComponent(row.placeId)}&sessionToken=${encodeURIComponent(sessionToken.current)}`,
        { headers: authHeaders() },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "Could not load this place");
      const nextAddress = String(body.formattedAddress || row.label);
      skipLookup.current = nextAddress;
      lastReverse.current = pairKey(body.latitude, body.longitude);
      setQuery(nextAddress);
      setFocus((n) => n + 1);
      onChange({
        address: nextAddress,
        latitude: String(body.latitude),
        longitude: String(body.longitude),
        placeId: String(body.placeId || row.placeId),
        locationSource: "google_place",
        locationVerified: true,
      });
      sessionToken.current = newSessionToken();
      lastAutocomplete.current = "";
    } catch (err: any) {
      setError(err?.message || "Could not load this place");
    } finally {
      setBusy(false);
    }
  }

  async function refetch() {
    const q = query.trim();
    if (q.length < 3) {
      setError("Enter an address first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `${BACKEND}/google-maps/geocode?feature=${feature}&q=${encodeURIComponent(q)}`,
        { headers: authHeaders() },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "Could not find this address");
      const nextAddress = String(body.formattedAddress || q);
      skipLookup.current = nextAddress;
      lastReverse.current = pairKey(body.latitude, body.longitude);
      setQuery(nextAddress);
      setFocus((n) => n + 1);
      onChange({
        address: nextAddress,
        latitude: String(body.latitude),
        longitude: String(body.longitude),
        placeId: String(body.placeId || ""),
        locationSource: "google_geocode",
        locationVerified: true,
      });
    } catch (err: any) {
      setError(err?.message || "Could not find this address");
    } finally {
      setBusy(false);
    }
  }

  async function useDevice() {
    setBusy(true);
    setError("");
    try {
      const gps = await fetchGPSOnUserGesture();
      lastReverse.current = pairKey(gps.latitude, gps.longitude);
      setFocus((n) => n + 1);
      onChange({
        address: query,
        latitude: String(gps.latitude),
        longitude: String(gps.longitude),
        placeId: "",
        locationSource: "device",
        locationVerified: true,
      });
    } catch (err: any) {
      setError(err?.message || "Could not read this device location");
    } finally {
      setBusy(false);
    }
  }

  async function reverseLookup(la: number, ln: number) {
    const key = pairKey(la, ln);
    if (!key || lastReverse.current === key) return;
    lastReverse.current = key;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `${BACKEND}/google-maps/reverse?feature=${feature}&lat=${encodeURIComponent(String(la))}&lng=${encodeURIComponent(String(ln))}`,
        { headers: authHeaders() },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "Could not find an address for these coordinates");
      const nextAddress = String(body.formattedAddress || "");
      skipLookup.current = nextAddress;
      setQuery(nextAddress);
      setFocus((n) => n + 1);
      onChange({
        address: nextAddress,
        latitude: String(body.latitude ?? la),
        longitude: String(body.longitude ?? ln),
        placeId: String(body.placeId || ""),
        locationSource: "google_geocode",
        locationVerified: true,
      });
    } catch (err: any) {
      lastReverse.current = "";
      setError(err?.message || "Could not find an address for these coordinates");
    } finally {
      setBusy(false);
    }
  }

  function commitCoordinates(nextLat: string, nextLng: string) {
    const la = num(nextLat);
    const ln = num(nextLng);
    if (la == null || ln == null || (la === 0 && ln === 0)) return;
    void reverseLookup(la, ln);
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-800">
        {label}
        {required ? " *" : ""}
      </label>
      <textarea
        name="place-query"
        value={query}
        disabled={disabled}
        required={required}
        rows={2}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Start typing an address"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          onChange({ address: next });
        }}
      />
      {configured === false ? (
        <p className="text-xs text-amber-700">Google address search is not configured on the server.</p>
      ) : null}
      {open && suggestions.length > 0 && !disabled ? (
        <div className="relative z-30 max-h-48 overflow-auto rounded-md border border-gray-200 bg-white shadow-sm">
          {suggestions.map((row) => (
            <button
              key={row.placeId}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              onClick={() => choose(row)}
            >
              {row.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={refetch}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Re-fetch location
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={useDevice}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Use current device location
        </button>
      </div>
      {lat != null && lng != null ? (
        <ClientPinMap
          latitude={lat}
          longitude={lng}
          focus={focus}
          onMove={(nextLat, nextLng) => {
            lastReverse.current = pairKey(nextLat, nextLng);
            onChange({
              address: query,
              latitude: String(nextLat),
              longitude: String(nextLng),
              placeId: placeId || "",
              locationSource: "manual",
              locationVerified: true,
            });
          }}
        />
      ) : (
        <p className="text-xs text-gray-500">
          Choose an address suggestion, re-fetch, or use the device location. Then drag the pin onto the building before saving.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Latitude</p>
          <input
            name="place-latitude"
            autoComplete="off"
            value={latitude || ""}
            disabled={disabled}
            onChange={(e) => {
              latRef.current = e.target.value;
              onChange({ latitude: e.target.value, locationSource: "manual" });
            }}
            onBlur={() => commitCoordinates(latRef.current, lngRef.current)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Longitude</p>
          <input
            name="place-longitude"
            autoComplete="off"
            value={longitude || ""}
            disabled={disabled}
            onChange={(e) => {
              lngRef.current = e.target.value;
              onChange({ longitude: e.target.value, locationSource: "manual" });
            }}
            onBlur={() => commitCoordinates(latRef.current, lngRef.current)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Type an address or enter latitude and longitude. A verified pin is kept until you move it, edit the coordinates, or click Re-fetch. A 50–100 m geofence radius is enough once the pin is on the building.
      </p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {busy ? <p className="text-xs text-gray-500">Looking up location…</p> : null}
    </div>
  );
}
