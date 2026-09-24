import { Global, Module } from '@nestjs/common';
import { EnplSyncGuard } from '../enpl-sync/enpl-sync.guard';
import { EnplGoogleMapsController } from './enpl-google-maps.controller';
import { GoogleMapsController } from './google-maps.controller';
import { GoogleMapsService } from './google-maps.service';

@Global()
@Module({
  controllers: [GoogleMapsController, EnplGoogleMapsController],
  providers: [GoogleMapsService, EnplSyncGuard],
  exports: [GoogleMapsService],
})
export class GoogleMapsModule {}
