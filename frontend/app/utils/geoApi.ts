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
