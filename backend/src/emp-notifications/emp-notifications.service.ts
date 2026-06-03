import { Injectable } from '@nestjs/common';
import { empPayoutHrefForPeriod } from '../common/payslip-period.util';
import { PrismaService } from '../prisma/prisma.service';

export type EmpHolidayListItem = {
  id: number;
  name: string;
  financialYear: string | null;
  startDate: string;
  endDate: string;
  isUpcoming: boolean;
};

export type EmpNotificationFeedItem = {
  id: string;
  kind:
    | 'birthday'
    | 'holiday'
    | 'leave'
    | 'reimbursement'
    | 'payslip'
    | 'memo'
    | 'general';
  title: string;
  body: string;
  emoji: string;
  at: string;
  href?: string;
};

@Injectable()
export class EmpNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public holidays for the employee's company/branch and leave policy. */
  async getHolidayList(employeeId: number): Promise<EmpHolidayListItem[]> {
    const emp = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: { companyID: true, branchesID: true, leavePolicyID: true },
    });
    if (!emp?.companyID) return [];

    let policyPublicHolidayIds: number[] = [];
    if (emp.leavePolicyID) {
      const links = await this.prisma.leavePolicyHoliday.findMany({
        where: { leavePolicyID: emp.leavePolicyID },
        select: { publicHolidayID: true },
      });
      policyPublicHolidayIds = links
        .map((l) => l.publicHolidayID)
        .filter((id): id is number => id != null);
    }

    const where: {
      companyID: number;
      OR: Array<{ branchesID: null } | { branchesID: number }>;
      id?: { in: number[] };
    } = {
      companyID: emp.companyID,
      OR: [{ branchesID: null }],
    };
    if (emp.branchesID != null) {
      where.OR.push({ branchesID: emp.branchesID });
    }
    if (policyPublicHolidayIds.length > 0) {
      where.id = { in: policyPublicHolidayIds };
    }

    const rows = await this.prisma.publicHoliday.findMany({
      where,
      include: { manageHoliday: { select: { holidayName: true } } },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
      take: 500,
    });

    const today = this.localDay(new Date());
    return rows.map((h) => {
      const start = h.startDate ? this.localDay(new Date(h.startDate)) : today;
      const end = h.endDate ? this.localDay(new Date(h.endDate)) : start;
      return {
        id: h.id,
        name: h.manageHoliday?.holidayName?.trim() || 'Public holiday',
        financialYear: h.financialYear,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        isUpcoming: end.getTime() >= today.getTime(),
      };
    });
  }

  async getFeed(
    employeeId: number,
    recentDays = 7,
    olderDays = 90,
  ): Promise<{
    recent: EmpNotificationFeedItem[];
    older: EmpNotificationFeedItem[];
    hasMore: boolean;
  }> {
    const emp = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        companyID: true,
        branchesID: true,
        employeeFirstName: true,
        employeeLastName: true,
        dateOfBirth: true,
      },
    });
    if (!emp?.companyID) return { recent: [], older: [], hasMore: false };

    const now = new Date();
    const recentStart = this.addDays(now, -recentDays);
    const olderStart = this.addDays(now, -olderDays);

    const items: EmpNotificationFeedItem[] = [];

    items.push(...(await this.birthdayItems(emp, now, recentDays)));
    items.push(...(await this.holidayItems(emp, now, olderStart)));
    items.push(...(await this.personalLeaveItems(employeeId, olderStart, now)));
    items.push(...(await this.personalReimbItems(employeeId, olderStart, now)));
    items.push(...(await this.personalPayslipItems(employeeId, olderStart, now)));
    items.push(...(await this.personalMemoItems(employeeId, olderStart, now)));

    const sorted = items
      .filter((i) => {
        const t = new Date(i.at).getTime();
        return t >= olderStart.getTime() && t <= this.addDays(now, 1).getTime();
      })
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const personalKinds = new Set([
      'leave',
      'reimbursement',
      'payslip',
      'memo',
    ]);
    const recentCut = recentStart.getTime();
    const recent = sorted.filter((i) => {
      const t = new Date(i.at).getTime();
      if (t < recentCut) return false;
      if (i.kind === 'payslip') return true;
      if (personalKinds.has(i.kind) && !this.isEventToday(now, i.at)) {
        return false;
      }
      if (i.kind === 'holiday' && t < this.localDay(now).getTime()) {
        return false;
      }
      return true;
    });
    const older = sorted.filter((i) => {
      const t = new Date(i.at).getTime();
      if (t < recentCut) return true;
      if (personalKinds.has(i.kind) && !this.isEventToday(now, i.at)) {
        return true;
      }
      if (i.kind === 'holiday' && t < this.localDay(now).getTime()) {
        return true;
      }
      return false;
    });

    return { recent, older, hasMore: older.length > 0 };
  }

  private addDays(d: Date, days: number) {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    x.setHours(12, 0, 0, 0);
    return x;
  }

  /** Local calendar day at noon (stable for date comparisons). */
  private localDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  }

  private daysFromToday(today: Date, target: Date) {
    return Math.round((this.localDay(target).getTime() - this.localDay(today).getTime()) / 86400000);
  }

  /**
   * Returns a date-specific label for a holiday — the abbreviated month+day
   * so the frontend can render a distinct date badge (e.g. "4 Mar").
   * The emoji field is repurposed to carry this date string for holidays.
   */
  private calendarEmoji(date: Date): string {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }

  /** Personal / birthday items: visible only on the event calendar day. */
  private isEventToday(now: Date, at: Date | string) {
    return this.daysFromToday(now, new Date(at)) === 0;
  }

  private parseDob(dob: string | null | undefined): { month: number; day: number } | null {
    if (!dob) return null;
    const s = String(dob).trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return { month: Number(iso[2]), day: Number(iso[3]) };
    const slash = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (slash) return { month: Number(slash[2]), day: Number(slash[1]) };
    return null;
  }

  private birthdayEventDate(year: number, month: number, day: number) {
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  private async birthdayItems(
    emp: {
      id: number;
      companyID: number | null;
      employeeFirstName: string | null;
      employeeLastName: string | null;
      dateOfBirth: string | null;
    },
    now: Date,
    horizonDays: number,
  ): Promise<EmpNotificationFeedItem[]> {
    const company = emp.companyID
      ? await this.prisma.company.findUnique({
          where: { id: emp.companyID },
          select: { companyName: true },
        })
      : null;
    const companyLabel =
      company?.companyName?.trim() || 'your company';

    const colleagues = await this.prisma.manageEmployee.findMany({
      where: {
        companyID: emp.companyID ?? undefined,
        id: { not: emp.id },
        NOT: { employmentStatus: 'Terminated' },
      },
      select: {
        id: true,
        employeeFirstName: true,
        employeeLastName: true,
        dateOfBirth: true,
      },
      take: 500,
    });

    const all = [
      {
        id: emp.id,
        employeeFirstName: emp.employeeFirstName,
        employeeLastName: emp.employeeLastName,
        dateOfBirth: emp.dateOfBirth,
        isSelf: true,
      },
      ...colleagues.map((c) => ({ ...c, isSelf: false })),
    ];

    const out: EmpNotificationFeedItem[] = [];
    const y = now.getFullYear();

    for (const person of all) {
      const parts = this.parseDob(person.dateOfBirth);
      if (!parts) continue;
      for (const year of [y, y + 1]) {
        const eventAt = this.birthdayEventDate(year, parts.month, parts.day);
        const diff = this.daysFromToday(now, eventAt);
        if (diff !== 0) continue;
        const name =
          `${person.employeeFirstName ?? ''} ${person.employeeLastName ?? ''}`.trim() ||
          'Employee';
        out.push({
          id: `bday-${person.id}-${year}`,
          kind: 'birthday',
          title: person.isSelf
            ? 'Happy Birthday!'
            : `${name}'s birthday today`,
          body: person.isSelf
            ? `Wishing you a wonderful birthday from your ${companyLabel} family.`
            : `Don't forget to wish ${name} a happy birthday.`,
          emoji: '🎂',
          at: eventAt.toISOString(),
        });
      }
    }
    return out;
  }

  private async holidayItems(
    emp: { companyID: number | null; branchesID: number | null },
    now: Date,
    olderStart: Date,
  ): Promise<EmpNotificationFeedItem[]> {
    const today = this.localDay(now);
    const tomorrow = this.addDays(today, 1);
    const windowEnd = this.addDays(today, 1);
    const pastStart = this.localDay(olderStart);

    const holidays = await this.prisma.publicHoliday.findMany({
      where: {
        companyID: emp.companyID ?? undefined,
        OR: [{ branchesID: null }, { branchesID: emp.branchesID ?? undefined }],
        startDate: { lte: windowEnd },
        endDate: { gte: pastStart },
      },
      include: { manageHoliday: { select: { holidayName: true } } },
      take: 100,
    });

    const out: EmpNotificationFeedItem[] = [];
    const seen = new Set<string>();

    for (const h of holidays) {
      const name = h.manageHoliday?.holidayName || 'Public holiday';
      const rangeStart = this.localDay(h.startDate ? new Date(h.startDate) : today);
      const rangeEnd = this.localDay(h.endDate ? new Date(h.endDate) : rangeStart);

      let cursor = new Date(rangeStart);
      while (cursor.getTime() <= rangeEnd.getTime()) {
        const diff = this.daysFromToday(today, cursor);
        const dayKey = `${h.id}-${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;

        if (diff === 0 || diff === 1) {
          const slot = diff === 0 ? 'today' : 'tomorrow';
          const key = `holiday-${h.id}-${slot}`;
          if (!seen.has(key)) {
            seen.add(key);
            const notifyAt = diff === 0 ? today : tomorrow;
            out.push({
              id: key,
              kind: 'holiday' as const,
              title:
                diff === 0 ? 'Today — public holiday' : 'Tomorrow — public holiday',
              body: name,
              emoji: this.calendarEmoji(cursor),
              at: notifyAt.toISOString(),
            });
          }
        } else if (diff < 0 && cursor.getTime() >= pastStart.getTime()) {
          const key = `holiday-past-${dayKey}`;
          if (!seen.has(key)) {
            seen.add(key);
            out.push({
              id: key,
              kind: 'holiday' as const,
              title: name,
              body: 'Office holiday — plan your day accordingly.',
              emoji: this.calendarEmoji(cursor),
              at: cursor.toISOString(),
            });
          }
        }

        cursor = this.addDays(cursor, 1);
      }
    }

    return out;
  }

  private async personalLeaveItems(
    employeeId: number,
    since: Date,
    now: Date,
  ): Promise<EmpNotificationFeedItem[]> {
    const leaves = await this.prisma.leaveApplication.findMany({
      where: {
        manageEmployeeID: employeeId,
        status: { in: ['Approved', 'Accepted', 'Partly Approved', 'Rejected', 'Revoked'] },
      },
      orderBy: { id: 'desc' },
      take: 50,
    });

    return leaves
      .map((l) => {
        const status = l.status || 'Pending';
        const from = l.fromDate ? new Date(l.fromDate) : new Date();
        const to = l.toDate ? new Date(l.toDate) : from;
        const range = `${from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${to.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;

        let title = 'Leave update';
        let body = l.purpose || range;
        let emoji = '📅';

        if (status === 'Approved' || status === 'Accepted') {
          title = 'Leave approved';
          body = `Your leave (${range}) has been approved.`;
          emoji = '✅';
        } else if (status === 'Partly Approved') {
          title = 'Leave partly approved';
          body = `Your leave (${range}) was partly approved. Check details in the app.`;
          emoji = '🟡';
        } else if (status === 'Rejected') {
          title = 'Leave rejected';
          body = `Your leave request (${range}) was rejected.`;
          emoji = '❌';
        } else if (status === 'Revoked') {
          title = 'Leave cancelled';
          body = `Your approved leave (${range}) was cancelled.`;
          emoji = '🔄';
        }

        const at = l.toDate ?? l.fromDate ?? new Date();

        return {
          id: `leave-${l.id}-${status}`,
          kind: 'leave' as const,
          title,
          body,
          emoji,
          at: new Date(at as Date).toISOString(),
          href: '/empLeaveApplication',
        };
      })
      .filter((i) => new Date(i.at).getTime() >= since.getTime());
  }

  private async personalReimbItems(
    employeeId: number,
    since: Date,
    now: Date,
  ): Promise<EmpNotificationFeedItem[]> {
    const rows = await this.prisma.reimbursement.findMany({
      where: { manageEmployeeID: employeeId },
      orderBy: { id: 'desc' },
      take: 40,
    });

    return rows.flatMap((r) => {
      const status = r.status || 'Pending';
      if (status === 'Pending') return [];

      let title = 'Reimbursement update';
      let body = r.description || 'Your reimbursement claim was updated.';
      let emoji = '💰';

      if (status === 'Approved' || status === 'Partly Approved') {
        title = 'Reimbursement approved';
        body = 'Your reimbursement claim has been approved.';
        emoji = '✅';
      } else if (status === 'Paid') {
        title = 'Reimbursement paid';
        body = r.paymentRemark
          ? `Reimbursement paid. ${r.paymentRemark}`
          : 'Your reimbursement has been marked as paid.';
        emoji = '💸';
      } else if (status === 'Rejected') {
        title = 'Reimbursement rejected';
        body = 'Your reimbursement claim was rejected.';
        emoji = '❌';
      }

      const at = r.paymentDate || r.voucherDate || r.date || new Date().toISOString();
      if (new Date(at).getTime() < since.getTime()) return [];

      return [
        {
          id: `reimb-${r.id}-${status}`,
          kind: 'reimbursement' as const,
          title,
          body,
          emoji,
          at: new Date(at).toISOString(),
          href: '/empReimbursement',
        },
      ];
    });
  }

  private async personalPayslipItems(
    employeeId: number,
    since: Date,
    now: Date,
  ): Promise<EmpNotificationFeedItem[]> {
    const slips = await this.prisma.generateSalary.findMany({
      where: {
        employeeID: employeeId,
        status: { in: ['Pending', 'Paid'] },
      },
      orderBy: { id: 'desc' },
      take: 24,
    });

    return slips.flatMap((s) => {
      const items: EmpNotificationFeedItem[] = [];
      const createdAt = (s as { createdAt?: Date }).createdAt;
      const updatedAt = (s as { updatedAt?: Date }).updatedAt;

      if (createdAt) {
        const at = new Date(createdAt).toISOString();
        if (new Date(at).getTime() >= since.getTime()) {
          items.push({
            id: `payslip-${s.id}-generated`,
            kind: 'payslip',
            title: 'Salary slip available',
            body: `Your payslip for ${s.monthPeriod} is ready to view.`,
            emoji: '🧾',
            at,
            href: empPayoutHrefForPeriod(s.monthPeriod),
          });
        }
      }

      if (s.status === 'Paid') {
        const paidSource = s.paymentDate || updatedAt || createdAt;
        const at = paidSource
          ? new Date(paidSource).toISOString()
          : new Date().toISOString();
        if (new Date(at).getTime() >= since.getTime()) {
          items.push({
            id: `payslip-${s.id}-paid`,
            kind: 'payslip',
            title: 'Salary paid',
            body: `Your salary for ${s.monthPeriod} has been paid.`,
            emoji: '💰',
            at,
            href: empPayoutHrefForPeriod(s.monthPeriod),
          });
        }
      } else if (!createdAt) {
        const at = new Date().toISOString();
        items.push({
          id: `payslip-${s.id}-pending`,
          kind: 'payslip',
          title: 'Salary slip available',
          body: `Your payslip for ${s.monthPeriod} is ready to view.`,
          emoji: '🧾',
          at,
          href: empPayoutHrefForPeriod(s.monthPeriod),
        });
      }

      return items;
    });
  }

  private async personalMemoItems(
    employeeId: number,
    since: Date,
    now: Date,
  ): Promise<EmpNotificationFeedItem[]> {
    const memos = await this.prisma.employeeMemo.findMany({
      where: { employeeID: employeeId },
      orderBy: { id: 'desc' },
      take: 30,
    });

    return memos.flatMap((m) => {
      const at = m.createdAt ?? m.issuedDate ?? new Date();
      if (new Date(at).getTime() < since.getTime()) return [];
      const type = m.memoType || 'General';
      let emoji = '📢';
      if (type === 'Warning') emoji = '⚠️';
      if (type === 'Appreciation') emoji = '🏅';
      if (type === 'Policy') emoji = '📋';
      return [
        {
          id: `memo-${m.id}`,
          kind: 'memo' as const,
          title: m.subject || `${type} memo`,
          body: (m.description || '').slice(0, 160) || 'New notice from HR.',
          emoji,
          at: new Date(at).toISOString(),
          href: '/empNoticeboard',
        },
      ];
    });
  }
}
