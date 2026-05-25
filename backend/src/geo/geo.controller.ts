import { Controller, Get, Query } from '@nestjs/common';
import { GeoService } from './geo.service';

@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('countries')
  searchCountries(@Query('q') q = '') {
    return this.geoService.searchCountries(q);
  }

  @Get('states')
  searchStates(@Query('country') country = '', @Query('q') q = '') {
    return this.geoService.searchStates(country, q);
  }

  @Get('cities')
  searchCities(
    @Query('country') country = '',
    @Query('state') state = '',
    @Query('q') q = '',
  ) {
    return this.geoService.searchCities(country, state, q);
  }

  @Get('currencies')
  searchCurrencies(@Query('q') q = '') {
    return this.geoService.searchCurrencies(q);
  }
}
