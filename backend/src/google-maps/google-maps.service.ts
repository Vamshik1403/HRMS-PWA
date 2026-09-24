import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type GoogleFeature = 'branch' | 'wfh' | 'site' | 'ENPL Site';
export type GoogleApiName = 'places_autocomplete' | 'place_details' | 'geocode' | 'reverse_geocode';

const SOURCES = new Set(['google_place', 'google_geocode', 'manual', 'device']);

export type ResolvedPin = {
  latitude: string;
  longitude: string;
  placeId: string | null;
  locationSource: string;
  locationVerified: boolean;
};

function usablePair(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (lat == null || lng == null || lat === '' || lng === '') return null;
  const la = typeof lat === 'number' ? lat : Number(String(lat).trim());
  const ln = typeof lng === 'number' ? lng : Number(String(lng).trim());
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la === 0 && ln === 0) return null;
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  return { lat: la, lng: ln };
}

function normAddress(value?: string | null): string {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function componentText(row: any): string {
  return String(row?.longText || row?.long_name || row?.shortText || row?.short_name || '').trim();
}

function addressParts(components: any[] | undefined) {
  const list = Array.isArray(components) ? components : [];
  const pick = (...types: string[]) => {
    for (const type of types) {
      const hit = list.find((row) => Array.isArray(row?.types) && row.types.includes(type));
      const text = componentText(hit);
      if (text) return text;
    }
    return '';
  };
  return {
    city: pick('locality', 'postal_town', 'administrative_area_level_3', 'administrative_area_level_2', 'sublocality'),
    state: pick('administrative_area_level_1'),
    pinCode: pick('postal_code'),
  };
}

@Injectable()
export class GoogleMapsService {
  private readonly logger = new Logger(GoogleMapsService.name);
  private readonly autocompleteCache = new Map<string, { at: number; rows: { placeId: string; label: string }[] }>();

  constructor(private readonly prisma: PrismaService) {}

  private apiKey(): string {
    return String(process.env.GOOGLE_MAPS_SERVER_KEY || '').trim();
  }

  async autocomplete(query: string, feature: GoogleFeature, sessionToken: string) {
    const q = query.trim();
    if (q.length < 3) return [];
    if (!this.apiKey()) return [];
    const cacheKey = `${feature}:${q.toLowerCase()}`;
    const cached = this.autocompleteCache.get(cacheKey);
    if (cached && Date.now() - cached.at < 60_000) return cached.rows;
    const data = await this.callGoogle(
      'places_autocomplete',
      feature,
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey(),
          'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
        },
        body: JSON.stringify({
          input: q,
          includedRegionCodes: ['in'],
          languageCode: 'en',
          sessionToken,
        }),
      },
      sessionToken,
    );
    const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
    const rows = suggestions
      .map((row: any) => {
        const prediction = row?.placePrediction;
        const placeId = String(prediction?.placeId || '').trim();
        const label = String(prediction?.text?.text || '').trim();
        if (!placeId || !label) return null;
        return { placeId, label };
      })
      .filter(Boolean) as { placeId: string; label: string }[];
    if (data) this.autocompleteCache.set(cacheKey, { at: Date.now(), rows });
    return rows;
  }

  async placeDetails(placeId: string, feature: GoogleFeature, sessionToken: string) {
    const id = placeId.trim();
    if (!id) throw new BadRequestException('Place is required.');
    if (!this.apiKey()) {
      throw new BadRequestException(
        'Could not find coordinates for this address. Please check the address.',
      );
    }
    const data = await this.callGoogle(
      'place_details',
      feature,
      `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?sessionToken=${encodeURIComponent(sessionToken)}`,
      {
        headers: {
          'X-Goog-Api-Key': this.apiKey(),
          'X-Goog-FieldMask': 'id,formattedAddress,location',
        },
      },
      sessionToken,
    );
    const lat = Number(data?.location?.latitude);
    const lng = Number(data?.location?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException(
        'Could not find coordinates for this address. Please check the address.',
      );
    }
    return {
      placeId: String(data?.id || id),
      formattedAddress: String(data?.formattedAddress || '').trim(),
      latitude: String(lat),
      longitude: String(lng),
      locationSource: 'google_place',
      locationVerified: true,
    };
  }

  async enplPlaceDetails(placeId: string, sessionToken: string) {
    const feature: GoogleFeature = 'ENPL Site';
    const id = placeId.trim();
    if (!id) throw new BadRequestException('Place is required.');
    if (!this.apiKey()) {
      throw new BadRequestException(
        'Could not find coordinates for this address. Please check the address.',
      );
    }
    const data = await this.callGoogle(
      'place_details',
      feature,
      `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?sessionToken=${encodeURIComponent(sessionToken)}`,
      {
        headers: {
          'X-Goog-Api-Key': this.apiKey(),
          'X-Goog-FieldMask': 'id,formattedAddress,location,addressComponents',
        },
      },
      sessionToken,
    );
    const lat = Number(data?.location?.latitude);
    const lng = Number(data?.location?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException(
        'Could not find coordinates for this address. Please check the address.',
      );
    }
    const parts = addressParts(data?.addressComponents);
    return {
      formattedAddress: String(data?.formattedAddress || '').trim(),
      latitude: lat,
      longitude: lng,
      placeId: String(data?.id || id),
      city: parts.city,
      state: parts.state,
      pinCode: parts.pinCode,
    };
  }

  async geocode(query: string, feature: GoogleFeature) {
    const q = query.replace(/\s+/g, ' ').trim();
    if (q.length < 3 || !this.apiKey()) return null;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&components=country:IN&key=${encodeURIComponent(this.apiKey())}`;
    const data = await this.callGoogle('geocode', feature, url, {});
    const hit = data?.results?.[0];
    const lat = Number(hit?.geometry?.location?.lat);
    const lng = Number(hit?.geometry?.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      placeId: hit?.place_id ? String(hit.place_id) : null,
      formattedAddress: String(hit?.formatted_address || q).trim(),
      latitude: String(lat),
      longitude: String(lng),
      locationSource: 'google_geocode',
      locationVerified: true,
    };
  }

  async reverseGeocode(lat: unknown, lng: unknown, feature: GoogleFeature) {
    const point = usablePair(lat, lng);
    if (!point) throw new BadRequestException('Enter a valid latitude and longitude.');
    if (!this.apiKey()) {
      throw new BadRequestException('Could not find an address for these coordinates.');
    }
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${point.lat},${point.lng}`)}` +
      `&key=${encodeURIComponent(this.apiKey())}`;
    const data = await this.callGoogle('reverse_geocode', feature, url, {});
    const hit = data?.results?.[0];
    const formattedAddress = String(hit?.formatted_address || '').trim();
    if (!formattedAddress) {
      throw new BadRequestException('Could not find an address for these coordinates.');
    }
    return {
      placeId: hit?.place_id ? String(hit.place_id) : null,
      formattedAddress,
      latitude: String(point.lat),
      longitude: String(point.lng),
      locationSource: 'google_geocode',
      locationVerified: true,
    };
  }

  async enplReverseGeocode(lat: unknown, lng: unknown) {
    const feature: GoogleFeature = 'ENPL Site';
    const point = usablePair(lat, lng);
    if (!point) throw new BadRequestException('Enter a valid latitude and longitude.');
    if (!this.apiKey()) {
      throw new BadRequestException('Could not find an address for these coordinates.');
    }
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${point.lat},${point.lng}`)}` +
      `&key=${encodeURIComponent(this.apiKey())}`;
    const data = await this.callGoogle('reverse_geocode', feature, url, {});
    const hit = data?.results?.[0];
    const formattedAddress = String(hit?.formatted_address || '').trim();
    if (!formattedAddress) {
      throw new BadRequestException('Could not find an address for these coordinates.');
    }
    const parts = addressParts(hit?.address_components);
    return {
      formattedAddress,
      latitude: point.lat,
      longitude: point.lng,
      placeId: hit?.place_id ? String(hit.place_id) : '',
      city: parts.city,
      state: parts.state,
      pinCode: parts.pinCode,
    };
  }

  /**
   * Save a confirmed pin without calling Google.
   * Google Geocoding runs only for an explicit re-fetch or when no usable coordinates exist.
   */
  async resolvePin(opts: {
    feature: GoogleFeature;
    addressQuery: string;
    incomingLat?: unknown;
    incomingLng?: unknown;
    incomingPlaceId?: string | null;
    incomingSource?: string | null;
    refetch?: boolean;
    existing?: {
      latitude?: string | number | null;
      longitude?: string | number | null;
      placeId?: string | null;
      locationSource?: string | null;
      locationVerified?: boolean | null;
      address?: string | null;
    } | null;
    missingMessage: string;
  }): Promise<ResolvedPin | null> {
    const query = opts.addressQuery.replace(/\s+/g, ' ').trim();
    const incoming = usablePair(opts.incomingLat, opts.incomingLng);
    if (opts.refetch) {
      if (!query) throw new BadRequestException(opts.missingMessage);
      const point = await this.geocode(query, opts.feature);
      if (!point) throw new BadRequestException(opts.missingMessage);
      return {
        latitude: point.latitude,
        longitude: point.longitude,
        placeId: point.placeId,
        locationSource: 'google_geocode',
        locationVerified: true,
      };
    }
    if (incoming) {
      const source = SOURCES.has(String(opts.incomingSource || ''))
        ? String(opts.incomingSource)
        : opts.incomingPlaceId
          ? 'google_place'
          : 'manual';
      return {
        latitude: String(incoming.lat),
        longitude: String(incoming.lng),
        placeId: opts.incomingPlaceId?.trim() || null,
        locationSource: source,
        locationVerified: true,
      };
    }

    const existingPoint = usablePair(opts.existing?.latitude, opts.existing?.longitude);
    const addressSame =
      normAddress(query) === normAddress(opts.existing?.address) || !query;
    if (existingPoint && (opts.existing?.locationVerified || addressSame)) {
      return {
        latitude: String(existingPoint.lat),
        longitude: String(existingPoint.lng),
        placeId: opts.existing?.placeId ?? null,
        locationSource: opts.existing?.locationSource || 'manual',
        locationVerified: !!opts.existing?.locationVerified,
      };
    }

    if (!query) return null;
    const point = await this.geocode(query, opts.feature);
    if (!point) throw new BadRequestException(opts.missingMessage);
    return {
      latitude: point.latitude,
      longitude: point.longitude,
      placeId: point.placeId,
      locationSource: 'google_geocode',
      locationVerified: true,
    };
  }

  async usageSummary() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const num = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const year = num('year');
    const month = num('month');
    const day = num('day');
    const istStart = (y: number, m: number, d: number) =>
      new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+05:30`);
    const thisStart = istStart(year, month, 1);
    const prevStart = month === 1 ? istStart(year - 1, 12, 1) : istStart(year, month - 1, 1);
    const todayStart = istStart(year, month, day);
    const rows = await this.prisma.googleApiUsage.findMany({
      where: { createdAt: { gte: prevStart } },
      select: { api: true, feature: true, httpStatus: true, sessionToken: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const blank = () => ({
      total: 0,
      byApi: {} as Record<string, number>,
      byFeature: {} as Record<string, number>,
    });
    const current = blank();
    const previous = blank();
    let today = 0;
    for (const row of rows) {
      if (row.createdAt >= todayStart) today += 1;
      const bucket = row.createdAt >= thisStart ? current : previous;
      bucket.total += 1;
      bucket.byApi[row.api] = (bucket.byApi[row.api] || 0) + 1;
      bucket.byFeature[row.feature] = (bucket.byFeature[row.feature] || 0) + 1;
    }
    const trend = Array.from({ length: 14 }, (_, index) => {
      const start = new Date(todayStart.getTime() - (13 - index) * 86400000);
      const end = new Date(start.getTime() + 86400000);
      const count = rows.filter((row) => row.createdAt >= start && row.createdAt < end).length;
      const label = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        month: 'short',
        day: 'numeric',
      }).format(start);
      return { day: label, count };
    });
    const quota = Number(process.env.GOOGLE_MAPS_MONTHLY_QUOTA || 0);
    const quotaLimit = Number.isFinite(quota) && quota > 0 ? quota : null;
    return {
      source: 'internal_request_count',
      configured: !!this.apiKey(),
      services: ['Address Autocomplete', 'Place Details', 'Geocoding', 'Reverse Geocoding'],
      note: 'These are requests counted inside OpenHRM. They are not Google Cloud invoices. Official billing, quotas, and budget alerts stay in Google Cloud Console.',
      mapsNote:
        'The map itself uses a separate referrer-restricted browser key. Map loads are not included in this internal count.',
      quotaLimit,
      quotaPercent:
        quotaLimit != null ? Math.round((current.total / quotaLimit) * 1000) / 10 : null,
      today,
      currentMonth: current,
      previousMonth: previous,
      openhrm: {
        autocomplete: current.byApi.places_autocomplete || 0,
        placeDetails: current.byApi.place_details || 0,
        geocode: current.byApi.geocode || 0,
        reverseGeocode: current.byApi.reverse_geocode || 0,
        total: current.total,
      },
      googleCloud: this.billableEstimate(
        rows.filter((row) => row.createdAt >= thisStart),
      ),
      trend,
      recent: rows.slice(0, 20).map((row) => ({
        api: row.api,
        feature: row.feature,
        httpStatus: row.httpStatus,
        createdAt: row.createdAt,
      })),
    };
  }

  private billableEstimate(
    rows: { api: string; httpStatus: number; sessionToken: string | null }[],
  ) {
    const reached = rows.filter((row) => row.httpStatus > 0);
    const groups = new Map<string, { auto: number; details: number }>();
    let billableAutocomplete = 0;
    let billablePlaceDetails = 0;
    for (const row of reached) {
      if (row.api !== 'places_autocomplete' && row.api !== 'place_details') continue;
      if (!row.sessionToken) {
        if (row.api === 'places_autocomplete') billableAutocomplete += 1;
        else billablePlaceDetails += 1;
        continue;
      }
      const group = groups.get(row.sessionToken) || { auto: 0, details: 0 };
      if (row.api === 'places_autocomplete') group.auto += 1;
      else group.details += 1;
      groups.set(row.sessionToken, group);
    }
    for (const group of groups.values()) {
      if (group.details > 0) billableAutocomplete += Math.min(group.auto, 12);
      else billableAutocomplete += group.auto;
      billablePlaceDetails += group.details;
    }
    return {
      billableAutocomplete,
      billablePlaceDetails,
      actualUsage: null,
      actualCost: null,
      note: 'Billable counts follow Google’s Essentials session rule for calls that reached Google. A finished session counts at most 12 autocomplete requests plus each Place Details call. This is not an invoice. Actual usage and cost are in Google Cloud Billing.',
    };
  }

  private async callGoogle(
    api: GoogleApiName,
    feature: GoogleFeature,
    url: string,
    init: RequestInit,
    sessionToken?: string,
  ): Promise<any> {
    let status = 0;
    try {
      const res = await fetch(url, init);
      status = res.status;
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        this.logger.warn(`Google ${api} failed: ${status}`);
        return null;
      }
      if (
        (api === 'geocode' || api === 'reverse_geocode') &&
        data?.status &&
        data.status !== 'OK' &&
        data.status !== 'ZERO_RESULTS'
      ) {
        this.logger.warn(`Google ${api} status ${data.status}`);
      }
      return data;
    } catch (err: any) {
      status = 0;
      this.logger.warn(`Google ${api} error: ${err?.message || err}`);
      return null;
    } finally {
      void this.prisma.googleApiUsage
        .create({ data: { api, feature, httpStatus: status, sessionToken: sessionToken || null } })
        .catch(() => null);
    }
  }
}
