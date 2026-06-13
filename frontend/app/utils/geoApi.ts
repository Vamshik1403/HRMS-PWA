const BASE = '/backend/geo';

export async function fetchCountries(q: string) {
  const res = await fetch(`${BASE}/countries?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchStates(country: string, q: string) {
  if (!country.trim()) return [];
  const res = await fetch(
    `${BASE}/states?country=${encodeURIComponent(country)}&q=${encodeURIComponent(q)}`,
  );
  if (!res.ok) return [];
  return res.json();
}

export async function fetchCities(country: string, state: string, q: string) {
  if (!country.trim() || !state.trim()) return [];
  const res = await fetch(
    `${BASE}/cities?country=${encodeURIComponent(country)}&state=${encodeURIComponent(state)}&q=${encodeURIComponent(q)}`,
  );
  if (!res.ok) return [];
  return res.json();
}

export async function fetchCurrencies(q: string) {
  const res = await fetch(`${BASE}/currencies?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return res.json();
}

export type PincodeLocation = {
  city: string;
  state: string;
  country: string;
};

export async function fetchLocationByPincode(
  pincode: string,
  country = '',
): Promise<PincodeLocation | null> {
  const code = pincode.replace(/\s/g, '');
  if (!code || code.length < 4) return null;
  const params = new URLSearchParams({ code });
  if (country.trim()) params.set('country', country.trim());
  const res = await fetch(`${BASE}/pincode?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.city && !data?.state && !data?.country) return null;
  return data as PincodeLocation;
}
