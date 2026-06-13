import { Injectable } from '@nestjs/common';
import { City, Country, State } from 'country-state-city';

const CURRENCY_MAP = (() => {
  const map = new Map<string, { code: string; name: string; countries: string[] }>();
  for (const c of Country.getAllCountries()) {
    const code = c.currency?.trim();
    if (!code) continue;
    const existing = map.get(code);
    if (existing) {
      if (!existing.countries.includes(c.name)) existing.countries.push(c.name);
    } else {
      map.set(code, { code, name: code, countries: [c.name] });
    }
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
})();

@Injectable()
export class GeoService {
  searchCountries(q: string, limit = 15) {
    const query = q.trim().toLowerCase();
    const all = Country.getAllCountries();
    const filtered = query
      ? all.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            c.isoCode.toLowerCase().includes(query),
        )
      : all;
    return filtered.slice(0, limit).map((c) => ({
      name: c.name,
      isoCode: c.isoCode,
      currency: c.currency,
    }));
  }

  searchStates(country: string, q: string, limit = 15) {
    const countryCode = this.resolveCountryCode(country);
    if (!countryCode) return [];
    const query = q.trim().toLowerCase();
    const all = State.getStatesOfCountry(countryCode);
    const filtered = query
      ? all.filter(
          (s) =>
            s.name.toLowerCase().includes(query) ||
            s.isoCode.toLowerCase().includes(query),
        )
      : all;
    return filtered.slice(0, limit).map((s) => ({
      name: s.name,
      isoCode: s.isoCode,
      countryCode: s.countryCode,
    }));
  }

  searchCities(country: string, state: string, q: string, limit = 15) {
    const countryCode = this.resolveCountryCode(country);
    if (!countryCode) return [];
    const stateCode = this.resolveStateCode(countryCode, state);
    if (!stateCode) return [];
    const query = q.trim().toLowerCase();
    const all = City.getCitiesOfState(countryCode, stateCode);
    const filtered = query
      ? all.filter((c) => c.name.toLowerCase().includes(query))
      : all;
    return filtered.slice(0, limit).map((c) => ({
      name: c.name,
      stateCode: c.stateCode,
      countryCode: c.countryCode,
    }));
  }

  searchCurrencies(q: string, limit = 15) {
    const query = q.trim().toLowerCase();
    const filtered = query
      ? CURRENCY_MAP.filter(
          (c) =>
            c.code.toLowerCase().includes(query) ||
            c.countries.some((n) => n.toLowerCase().includes(query)),
        )
      : CURRENCY_MAP;
    return filtered.slice(0, limit).map((c) => ({
      code: c.code,
      label: c.code,
      countries: c.countries.slice(0, 3).join(', '),
    }));
  }

  async lookupByPincode(
    pincode: string,
    countryHint = '',
  ): Promise<{ city: string; state: string; country: string } | null> {
    const code = pincode.replace(/\s/g, '');
    if (!code || code.length < 4) return null;

    if (/^\d{6}$/.test(code)) {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${code}`);
        if (res.ok) {
          const data = (await res.json()) as Array<{
            Status?: string;
            PostOffice?: Array<{
              District?: string;
              Name?: string;
              State?: string;
              Country?: string;
            }>;
          }>;
          const po = data?.[0]?.PostOffice?.[0];
          if (data?.[0]?.Status === 'Success' && po) {
            return {
              city: po.District || po.Name || '',
              state: po.State || '',
              country: po.Country || 'India',
            };
          }
        }
      } catch {
        /* try international fallback below */
      }
    }

    const countryCode = this.resolveCountryCode(countryHint);
    if (countryCode) {
      try {
        const res = await fetch(
          `https://api.zippopotam.us/${countryCode.toLowerCase()}/${encodeURIComponent(code)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as {
            country?: string;
            places?: Array<{ 'place name'?: string; state?: string }>;
          };
          const place = data.places?.[0];
          if (place) {
            return {
              city: place['place name'] || '',
              state: place.state || '',
              country: data.country || countryHint,
            };
          }
        }
      } catch {
        /* ignore */
      }
    }

    return null;
  }

  private resolveCountryCode(country: string): string | null {
    const trimmed = country.trim();
    if (!trimmed) return null;
    const byIso = Country.getCountryByCode(trimmed.toUpperCase());
    if (byIso) return byIso.isoCode;
    const byName = Country.getAllCountries().find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    return byName?.isoCode ?? null;
  }

  private resolveStateCode(countryCode: string, state: string): string | null {
    const trimmed = state.trim();
    if (!trimmed) return null;
    const states = State.getStatesOfCountry(countryCode);
    const byIso = states.find((s) => s.isoCode.toLowerCase() === trimmed.toLowerCase());
    if (byIso) return byIso.isoCode;
    const byName = states.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    return byName?.isoCode ?? null;
  }
}
