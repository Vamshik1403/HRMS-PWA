import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as webpush from 'web-push';

const SUBSCRIPTIONS_DIR =
  process.env.PUSH_SUBSCRIPTIONS_DIR || path.join(process.cwd(), 'data');
const SUBSCRIPTIONS_FILE = path.join(SUBSCRIPTIONS_DIR, 'push-subscriptions.json');

export interface PushSubscriptionRecord {
  employeeID: number;
  subscription: webpush.PushSubscription;
}

function decodeBase64Url(value: string): Buffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

/** Browser push keys must decode to 65-byte p256dh and 16-byte auth secrets. */
export function isValidPushSubscription(
  subscription: webpush.PushSubscription | null | undefined,
): boolean {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return false;
  }
  try {
    const p256dh = decodeBase64Url(subscription.keys.p256dh);
    const auth = decodeBase64Url(subscription.keys.auth);
    return p256dh.length === 65 && auth.length === 16;
  } catch {
    return false;
  }
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

  hasSubscription(employeeID: number): boolean {
    const empId = this.normalizeEmployeeId(employeeID);
    const records = this.readSubscriptions();
    const record = records.find(r => Number(r.employeeID) === empId);
    return !!record && isValidPushSubscription(record.subscription);
  }

  private ensureSubscriptionsDir(): void {
    if (!fs.existsSync(SUBSCRIPTIONS_DIR)) {
      fs.mkdirSync(SUBSCRIPTIONS_DIR, { recursive: true });
    }
  }

  private normalizeEmployeeId(employeeID: number): number {
    const id = Number(employeeID);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error(`Invalid employeeID: ${employeeID}`);
    }
    return id;
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
      this.ensureSubscriptionsDir();
      fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(records, null, 2), 'utf-8');
    } catch (err) {
      this.logger.error('Failed to write subscriptions file', err);
    }
  }

  saveSubscription(employeeID: number, subscription: webpush.PushSubscription): void {
    const empId = this.normalizeEmployeeId(employeeID);
    if (!isValidPushSubscription(subscription)) {
      throw new Error('Invalid push subscription (missing endpoint or malformed keys)');
    }
    const records = this.readSubscriptions();
    const filtered = records.filter(r => Number(r.employeeID) !== empId);
    filtered.push({ employeeID: empId, subscription });
    this.writeSubscriptions(filtered);
    this.logger.log(
      `Saved push subscription for employee ${empId} → ${SUBSCRIPTIONS_FILE}`,
    );
  }

  async sendToEmployee(
    employeeID: number,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      this.logger.warn('VAPID keys not configured — skipping push send');
      return;
    }

    const empId = this.normalizeEmployeeId(employeeID);
    const records = this.readSubscriptions();
    const record = records.find(r => Number(r.employeeID) === empId);
    if (!record) {
      this.logger.log(`No push subscription for employee ${empId}`);
      return;
    }

    if (!isValidPushSubscription(record.subscription)) {
      this.logger.warn(
        `Removing invalid push subscription for employee ${empId} (corrupt keys)`,
      );
      this.writeSubscriptions(records.filter(r => Number(r.employeeID) !== empId));
      return;
    }

    const payload = JSON.stringify({ title, body, data: data || {} });

    try {
      await webpush.sendNotification(record.subscription, payload);
      this.logger.log(`Push sent to employee ${empId}: ${title}`);
    } catch (err: any) {
      const remove =
        err?.statusCode === 410 ||
        (typeof err?.message === 'string' &&
          (err.message.includes('p256dh') || err.message.includes('auth')));
      if (remove) {
        const updated = records.filter(r => Number(r.employeeID) !== empId);
        this.writeSubscriptions(updated);
        this.logger.warn(`Removed unusable subscription for employee ${empId}`);
      } else {
        this.logger.error(`Failed to send push to employee ${empId}`, err);
      }
    }
  }

  removeSubscription(employeeID: number): void {
    const empId = this.normalizeEmployeeId(employeeID);
    const records = this.readSubscriptions();
    this.writeSubscriptions(records.filter(r => Number(r.employeeID) !== empId));
  }
}
