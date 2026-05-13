import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as webpush from 'web-push';

const SUBSCRIPTIONS_FILE = path.join(process.cwd(), 'push-subscriptions.json');

export interface PushSubscriptionRecord {
  employeeID: number;
  subscription: webpush.PushSubscription;
}

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor() {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@openhrm.com';

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
    } else {
      this.logger.warn('VAPID keys not configured. Push notifications will not work.');
    }
  }

  getVapidPublicKey(): string {
    return process.env.VAPID_PUBLIC_KEY || '';
  }

  private readSubscriptions(): PushSubscriptionRecord[] {
    try {
      if (!fs.existsSync(SUBSCRIPTIONS_FILE)) return [];
      const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8');
      return JSON.parse(data) as PushSubscriptionRecord[];
    } catch {
      return [];
    }
  }

  private writeSubscriptions(records: PushSubscriptionRecord[]): void {
    try {
      fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(records, null, 2), 'utf-8');
    } catch (err) {
      this.logger.error('Failed to write subscriptions file', err);
    }
  }

  saveSubscription(employeeID: number, subscription: webpush.PushSubscription): void {
    const records = this.readSubscriptions();
    // Remove any existing subscription for this employee
    const filtered = records.filter(r => r.employeeID !== employeeID);
    filtered.push({ employeeID, subscription });
    this.writeSubscriptions(filtered);
    this.logger.log(`Saved push subscription for employee ${employeeID}`);
  }

  async sendToEmployee(
    employeeID: number,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    const records = this.readSubscriptions();
    const record = records.find(r => r.employeeID === employeeID);
    if (!record) {
      this.logger.log(`No push subscription for employee ${employeeID}`);
      return;
    }

    const payload = JSON.stringify({ title, body, data: data || {} });

    try {
      await webpush.sendNotification(record.subscription, payload);
      this.logger.log(`Push sent to employee ${employeeID}: ${title}`);
    } catch (err: any) {
      // 410 Gone = subscription expired, remove it
      if (err?.statusCode === 410) {
        const updated = records.filter(r => r.employeeID !== employeeID);
        this.writeSubscriptions(updated);
        this.logger.warn(`Removed expired subscription for employee ${employeeID}`);
      } else {
        this.logger.error(`Failed to send push to employee ${employeeID}`, err);
      }
    }
  }

  removeSubscription(employeeID: number): void {
    const records = this.readSubscriptions();
    this.writeSubscriptions(records.filter(r => r.employeeID !== employeeID));
  }
}
