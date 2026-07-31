import { Injectable } from '@nestjs/common';
import { empPayoutHrefForPeriod } from '../common/payslip-period.util';
import { EmpManagerScopeService } from '../common/emp-manager-scope.service';
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
  /** When set, this notification is about a linked reportee (manager PWA view). */
  subjectEmployeeId?: number;
  subjectEmployeeName?: string;
  isTeamItem?: boolean;
};

@Injectable()
export class EmpNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly managerScope: EmpManagerScopeService,
  ) {}

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
    const hasReportees = await this.managerScope.hasReportees(employeeId);

    if (hasReportees) {
      const directReporteeIds = await this.managerScope.getDirectReporteeIds(employeeId);
      for (const reporteeId of directReporteeIds) {
        items.push(...(await this.pendingLeaveItems(reporteeId, olderStart)));
        items.push(...(await this.personalLeaveItems(reporteeId, olderStart, now, true)));
        items.push(...(await this.personalReimbItems(reporteeId, olderStart, now, true)));
        items.push(...(await this.personalMemoItems(reporteeId, olderStart, now, true)));
      }
      items.push(...(await this.personalMemoItems(employeeId, olderStart, now, false)));
      items.push(...(await this.holidayItems(emp, now, olderStart)));
    } else {
      items.push(...(await this.birthdayItems(emp, now, recentDays)));
      items.push(...(await this.holidayItems(emp, now, olderStart)));
      items.push(...(await this.personalLeaveItems(employeeId, olderStart, now, false)));
      items.push(...(await this.personalReimbItems(employeeId, olderStart, now, false)));
      items.push(...(await this.personalPayslipItems(employeeId, olderStart, now, false)));
      items.push(...(await this.personalMemoItems(employeeId, olderStart, now, false)));
    }

    const sorted = items
      .filter((i) => {
        const t = new Date(i.at).getTime();
        return t >= olderStart.getTime() && t <= this.addDays(now, 1).getTime();
      })
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    /** Birthday day-of only; leave/reimbursement/memo use created/status time in item.at */
    const eventTodayKinds = new Set(['birthday']);
    const recentCut = recentStart.getTime();
    const recent = sorted.filter((i) => {
      const t = new Date(i.at).getTime();
      if (t < recentCut) return false;
      if (i.kind === 'payslip') return true;
      if (eventTodayKinds.has(i.kind) && !this.isEventToday(now, i.at)) {
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
      if (eventTodayKinds.has(i.kind) && !this.isEventToday(now, i.at)) {
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

  private async reporteeName(employeeId: number): Promise<string> {
    const e = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: { employeeFirstName: true, employeeLastName: true, employeeID: true },
    });
    const name = [e?.employeeFirstName, e?.employeeLastName].filter(Boolean).join(' ').trim();
    return name || e?.employeeID || `Employee #${employeeId}`;
  }

  private async pendingLeaveItems(
    employeeId: number,
    since: Date,
  ): Promise<EmpNotificationFeedItem[]> {
    const who = await this.reporteeName(employeeId);
    const leaves = await this.prisma.leaveApplication.findMany({
      where: { manageEmployeeID: employeeId, status: 'Pending' },
      orderBy: { id: 'desc' },
      take: 20,
    });
    return leaves
      .map((l) => {
        const from = l.fromDate ? new Date(l.fromDate) : new Date();
        const to = l.toDate ? new Date(l.toDate) : from;
        const range = `${from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${to.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
        const at = l.fromDate ?? new Date();
        return {
          id: `leave-pending-${l.id}`,
          kind: 'leave' as const,
          title: `${who}: Leave approval pending`,
          body: `Leave request (${range}) from ${who} needs your approval.`,
          emoji: '📋',
          at: new Date(at as Date).toISOString(),
          href: '/empLeaveApplication',
          isTeamItem: true,
          subjectEmployeeId: employeeId,
          subjectEmployeeName: who,
        };
      })
      .filter((i) => new Date(i.at).getTime() >= since.getTime());
  }

  private async personalLeaveItems(
    employeeId: number,
    since: Date,
    now: Date,
    forReportee = false,
  ): Promise<EmpNotificationFeedItem[]> {
    const leaves = await this.prisma.leaveApplication.findMany({
      where: {
        manageEmployeeID: employeeId,
        status: { in: ['Approved', 'Accepted', 'Partially Approved', 'Rejected', 'Revoked'] },
        OR: [{ fromDate: { gte: since } }, { toDate: { gte: since } }],
      },
      orderBy: { id: 'desc' },
      take: 50,
    });

    const who = forReportee ? await this.reporteeName(employeeId) : null;

    return leaves
      .map((l) => {
        const status = l.status || 'Pending';
        const from = l.fromDate ? new Date(l.fromDate) : new Date();
        const to = l.toDate ? new Date(l.toDate) : from;
        const range = `${from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${to.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;

        let title = who ? `${who}: Leave update` : 'Leave update';
        let body = l.purpose || range;
        let emoji = '📅';

        if (status === 'Approved' || status === 'Accepted') {
          title = who ? `${who}: Leave approved` : 'Leave approved';
          body = who
            ? `Leave (${range}) for ${who} has been approved.`
            : `Your leave (${range}) has been approved.`;
          emoji = '✅';
        } else if (status === 'Partially Approved') {
          title = who ? `${who}: Leave partially approved` : 'Leave partially approved';
          body = who
            ? `Leave (${range}) for ${who} was partially approved.`
            : `Your leave (${range}) was partially approved. Check details in the app.`;
          emoji = '🟡';
        } else if (status === 'Rejected') {
          title = who ? `${who}: Leave rejected` : 'Leave rejected';
          body = who
            ? `Leave request (${range}) for ${who} was rejected.`
            : `Your leave request (${range}) was rejected.`;
          emoji = '❌';
        } else if (status === 'Revoked') {
          title = who ? `${who}: Leave cancelled` : 'Leave cancelled';
          body = who
            ? `Approved leave (${range}) for ${who} was cancelled.`
            : `Your approved leave (${range}) was cancelled.`;
          emoji = '🔄';
        }

        const periodAt = l.toDate ?? l.fromDate ?? now;
        const statusUpdate = ['Approved', 'Accepted', 'Partially Approved', 'Rejected', 'Revoked'].includes(
          status,
        );
        let at: Date;
        if (statusUpdate) {
          if (l.revokedAt) {
            at = new Date(l.revokedAt);
          } else {
            const p = new Date(periodAt);
            // Future-dated leave must not sort above today's notifications
            at = p.getTime() > now.getTime() ? now : p;
          }
        } else {
          at = new Date(periodAt);
        }

        return {
          id: `leave-${l.id}-${status}`,
          kind: 'leave' as const,
          title,
          body,
          emoji,
          at: at.toISOString(),
          href: '/empLeaveApplication',
          ...(forReportee
            ? {
                isTeamItem: true,
                subjectEmployeeId: employeeId,
                subjectEmployeeName: who ?? undefined,
              }
            : {}),
        };
      })
      .filter((i) => new Date(i.at).getTime() >= since.getTime());
  }

  private async personalReimbItems(
    employeeId: number,
    since: Date,
    now: Date,
    forReportee = false,
  ): Promise<EmpNotificationFeedItem[]> {
    const rows = await this.prisma.reimbursement.findMany({
      where: { manageEmployeeID: employeeId },
      orderBy: { id: 'desc' },
      take: 40,
    });

    const who = forReportee ? await this.reporteeName(employeeId) : null;

    return rows.flatMap((r) => {
      const status = r.status || 'Pending';
      if (status === 'Pending') return [];

      let title = who ? `${who}: Reimbursement update` : 'Reimbursement update';
      let body = r.description || (who ? `Reimbursement claim for ${who} was updated.` : 'Your reimbursement claim was updated.');
      let emoji = '💰';

      if (status === 'Approved' || status === 'Partially Approved') {
        title = who ? `${who}: Reimbursement approved` : 'Reimbursement approved';
        body = who ? `Reimbursement for ${who} has been approved.` : 'Your reimbursement claim has been approved.';
        emoji = '✅';
      } else if (status === 'Paid') {
        title = who ? `${who}: Reimbursement paid` : 'Reimbursement paid';
        body = r.paymentRemark
          ? `Reimbursement paid${who ? ` (${who})` : ''}. ${r.paymentRemark}`
          : who
            ? `Reimbursement for ${who} has been marked as paid.`
            : 'Your reimbursement has been marked as paid.';
        emoji = '💸';
      } else if (status === 'Rejected') {
        title = who ? `${who}: Reimbursement rejected` : 'Reimbursement rejected';
        body = who ? `Reimbursement claim for ${who} was rejected.` : 'Your reimbursement claim was rejected.';
        emoji = '❌';
      }

      const periodAt = r.paymentDate || r.voucherDate || r.date || now.toISOString();
      const at =
        status === 'Rejected' ? now.toISOString() : periodAt;
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
          ...(forReportee
            ? {
                isTeamItem: true,
                subjectEmployeeId: employeeId,
                subjectEmployeeName: who ?? undefined,
              }
            : {}),
        },
      ];
    });
  }

  private async personalPayslipItems(
    employeeId: number,
    since: Date,
    now: Date,
    forReportee = false,
  ): Promise<EmpNotificationFeedItem[]> {
    const slips = await this.prisma.generateSalary.findMany({
      where: {
        employeeID: employeeId,
        status: { in: ['Pending', 'Paid'] },
      },
      orderBy: { id: 'desc' },
      take: 24,
    });

    const who = forReportee ? await this.reporteeName(employeeId) : null;

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
            title: who ? `${who}: Salary slip available` : 'Salary slip available',
            body: who
              ? `Payslip for ${s.monthPeriod} (${who}) is ready to view.`
              : `Your payslip for ${s.monthPeriod} is ready to view.`,
            emoji: '🧾',
            at,
            href: empPayoutHrefForPeriod(s.monthPeriod),
            ...(forReportee
              ? {
                  isTeamItem: true,
                  subjectEmployeeId: employeeId,
                  subjectEmployeeName: who ?? undefined,
                }
              : {}),
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
            title: who ? `${who}: Salary paid` : 'Salary paid',
            body: who
              ? `Salary for ${s.monthPeriod} (${who}) has been paid.`
              : `Your salary for ${s.monthPeriod} has been paid.`,
            emoji: '💰',
            at,
            href: empPayoutHrefForPeriod(s.monthPeriod),
            ...(forReportee
              ? {
                  isTeamItem: true,
                  subjectEmployeeId: employeeId,
                  subjectEmployeeName: who ?? undefined,
                }
              : {}),
          });
        }
      } else if (!createdAt) {
        const at = new Date().toISOString();
        items.push({
          id: `payslip-${s.id}-pending`,
          kind: 'payslip',
          title: who ? `${who}: Salary slip available` : 'Salary slip available',
          body: who
            ? `Payslip for ${s.monthPeriod} (${who}) is ready to view.`
            : `Your payslip for ${s.monthPeriod} is ready to view.`,
          emoji: '🧾',
          at,
          href: empPayoutHrefForPeriod(s.monthPeriod),
          ...(forReportee
            ? {
                isTeamItem: true,
                subjectEmployeeId: employeeId,
                subjectEmployeeName: who ?? undefined,
              }
            : {}),
        });
      }

      return items;
    });
  }

  private async personalMemoItems(
    employeeId: number,
    since: Date,
    now: Date,
    forReportee = false,
  ): Promise<EmpNotificationFeedItem[]> {
    const memos = await this.prisma.employeeMemo.findMany({
      where: {
        OR: [
          { employeeID: employeeId },
          { employeeIDs: { has: employeeId } },
        ],
        parentMemoId: null,
        undoneAt: null,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const who = forReportee ? await this.reporteeName(employeeId) : null;

    return memos.flatMap((m) => {
      const at = m.createdAt ?? now;
      const type = m.memoType || 'General';
      const typeLc = type.toLowerCase();
      let emoji = '📢';
      if (typeLc.includes('warn')) emoji = '⚠️';
      else if (type === 'Appreciation') emoji = '🏅';
      else if (type === 'Policy') emoji = '📋';
      const baseTitle =
        typeLc.includes('warn')
          ? m.subject || 'Warning'
          : m.subject || 'New notice';
      const issuer = m.issuedBy?.trim();
      const preview = (m.description || '').trim().slice(0, 160);
      const body =
        preview ||
        (issuer
          ? `${issuer} sent you a ${typeLc.includes('warn') ? 'warning' : 'notice'}.`
          : 'You have a new notice on the board.');
      return [
        {
          id: `memo-${m.id}`,
          kind: 'memo' as const,
          title: who ? `${who}: ${baseTitle}` : baseTitle,
          body,
          emoji,
          at: new Date(at).toISOString(),
          href: '/empProfile?tab=messaging',
          ...(forReportee
            ? {
                isTeamItem: true,
                subjectEmployeeId: employeeId,
                subjectEmployeeName: who ?? undefined,
              }
            : {}),
        },
      ];
    });
  }
}
