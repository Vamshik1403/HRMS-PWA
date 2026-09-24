import { Injectable } from '@nestjs/common';
import { GoogleMapsService } from '../google-maps/google-maps.service';

export type ExternalApiStatus = 'active' | 'not_configured';

export type ExternalApiRow = {
  id: string;
  name: string;
  provider: string;
  status: ExternalApiStatus;
  summary: string;
  href?: string;
};

function configured(name: string): boolean {
  return !!String(process.env[name] || '').trim();
}

@Injectable()
export class ExternalApisService {
  constructor(private readonly googleMaps: GoogleMapsService) {}

  catalog() {
    const apis: ExternalApiRow[] = [
      {
        id: 'google-maps',
        name: 'Google Maps',
        provider: 'Google',
        status: configured('GOOGLE_MAPS_SERVER_KEY') ? 'active' : 'not_configured',
        summary: 'Address autocomplete, geocoding, and reverse geocoding for branch, site, and home pins.',
        href: '/system-apis/google-maps',
      },
      {
        id: 'smtp',
        name: 'Email/SMTP',
        provider: 'SMTP',
        status: configured('SMTP_HOST') ? 'active' : 'not_configured',
        summary: 'Leave, payroll, reimbursement, and backup email.',
      },
      {
        id: 'enpl-erp',
        name: 'ENPL ERP',
        provider: 'Electrohelps',
        status: configured('ENPL_ERP_BASE_URL') ? 'active' : 'not_configured',
        summary: 'Task and site sync with ENPL ERP.',
      },
      {
        id: 'dropbox',
        name: 'Dropbox backup',
        provider: 'Dropbox',
        status: configured('DROPBOX_ACCESS_TOKEN') ? 'active' : 'not_configured',
        summary: 'Optional cloud copy of the daily backup.',
      },
      {
        id: 'google-drive',
        name: 'Google Drive backup',
        provider: 'Google',
        status: configured('GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH') ? 'active' : 'not_configured',
        summary: 'Optional cloud copy of the daily backup.',
      },
      {
        id: 'aws-s3',
        name: 'Amazon S3 backup',
        provider: 'Amazon Web Services',
        status: configured('AWS_S3_BACKUP_BUCKET') ? 'active' : 'not_configured',
        summary: 'Optional cloud copy of the daily backup.',
      },
      {
        id: 'india-post',
        name: 'India Post pincode',
        provider: 'India Post',
        status: 'active',
        summary: 'Pincode lookup while filling Indian addresses. No API key.',
      },
      {
        id: 'zippopotam',
        name: 'Zippopotam',
        provider: 'Zippopotam',
        status: 'active',
        summary: 'Postal-code lookup outside India. No API key.',
      },
      {
        id: 'nominatim',
        name: 'Nominatim',
        provider: 'OpenStreetMap',
        status: process.env.GEOCODE_ENABLED === 'false' ? 'not_configured' : 'active',
        summary: 'Turns a punch GPS point into address text. Not used for branch, site, or home pins.',
      },
      {
        id: 'web-push',
        name: 'Web Push',
        provider: 'Browser push',
        status: configured('VAPID_PUBLIC_KEY') && configured('VAPID_PRIVATE_KEY') ? 'active' : 'not_configured',
        summary: 'PWA notifications. The public key is not a third-party secret.',
      },
      {
        id: 'whatsapp',
        name: 'WhatsApp',
        provider: 'Meta',
        status: 'not_configured',
        summary: 'Not connected in OpenHRM.',
      },
      {
        id: 'mailchimp',
        name: 'Mailchimp',
        provider: 'Intuit Mailchimp',
        status: 'not_configured',
        summary: 'Not connected in OpenHRM.',
      },
      {
        id: 'openai',
        name: 'OpenAI',
        provider: 'OpenAI',
        status: 'not_configured',
        summary: 'Not connected in OpenHRM.',
      },
    ];
    return {
      activeCount: apis.filter((row) => row.status === 'active').length,
      apis,
    };
  }

  googleMapsUsage() {
    return this.googleMaps.usageSummary();
  }
}
