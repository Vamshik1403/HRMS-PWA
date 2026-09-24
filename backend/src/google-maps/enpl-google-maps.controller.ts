import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EnplSyncGuard } from '../enpl-sync/enpl-sync.guard';
import { GoogleMapsService } from './google-maps.service';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller([
  'integration/enpl/google-maps',
  'integrations/enpl/google-maps',
  'api/integrations/enpl/google-maps',
])
@UseGuards(EnplSyncGuard)
export class EnplGoogleMapsController {
  constructor(private readonly google: GoogleMapsService) {}

  private enplSource(source?: string) {
    if (String(source || '').trim().toLowerCase() !== 'enpl') {
      throw new BadRequestException('x-sync-source must be enpl');
    }
  }

  private enplFeature(feature: unknown) {
    if (String(feature || '').trim() !== 'ENPL Site') {
      throw new BadRequestException('feature must be ENPL Site');
    }
  }

  private sessionToken(raw: unknown) {
    const value = String(raw || '').trim();
    if (!UUID_V4.test(value)) throw new BadRequestException('sessionToken must be a UUID.');
    return value;
  }

  @Post('autocomplete')
  @HttpCode(200)
  async autocomplete(@Body() body: any, @Headers('x-sync-source') source?: string) {
    this.enplSource(source);
    this.enplFeature(body?.feature);
    const rows = await this.google.autocomplete(
      String(body?.input || ''),
      'ENPL Site',
      this.sessionToken(body?.sessionToken),
    );
    return rows.map((row) => ({ placeId: row.placeId, description: row.label }));
  }

  @Post('place')
  @HttpCode(200)
  async place(@Body() body: any, @Headers('x-sync-source') source?: string) {
    this.enplSource(source);
    this.enplFeature(body?.feature);
    return this.google.enplPlaceDetails(String(body?.placeId || ''), this.sessionToken(body?.sessionToken));
  }

  @Post('reverse')
  @HttpCode(200)
  async reverse(@Body() body: any, @Headers('x-sync-source') source?: string) {
    this.enplSource(source);
    this.enplFeature(body?.feature);
    return this.google.enplReverseGeocode(body?.latitude, body?.longitude);
  }
}
