/** Pure helpers mirrored from privileged-leave.service attendance PL logic */

const APPROVED_LEAVE_STATUSES = ['Approved', 'Accepted', 'Partially Approved'];
const PAID_LEAVE_TYPES = ['Sick', 'Casual', 'Privileged', 'CompOff', 'Earn', 'PL', 'MtL', 'PtL'];

function addDateRangeToSet(
  target: Set<string>,
  start: Date,
  end: Date,
  fromDate?: string,
  toDate?: string,
) {
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split('T')[0];
    if (fromDate && key < fromDate) continue;
    if (toDate && key > toDate) continue;
    target.add(key);
  }
}

function calculatePlEarned(totalWorkingDays: number, workDays: number, plDays: number) {
  return Math.floor(totalWorkingDays / workDays) * plDays;
}

describe('privileged leave attendance calculation', () => {
  it('credits PL using configured ratio', () => {
    expect(calculatePlEarned(40, 20, 1)).toBe(2);
    expect(calculatePlEarned(19, 20, 1)).toBe(0);
  });

  it('respects date filters when expanding ranges', () => {
    const dates = new Set<string>();
    addDateRangeToSet(dates, new Date('2026-01-01'), new Date('2026-01-05'), '2026-01-02', '2026-01-04');
    expect([...dates].sort()).toEqual(['2026-01-02', '2026-01-03', '2026-01-04']);
  });

  it('includes accepted and partially approved leave statuses in policy constants', () => {
    expect(APPROVED_LEAVE_STATUSES).toContain('Accepted');
    expect(APPROVED_LEAVE_STATUSES).toContain('Partially Approved');
    expect(PAID_LEAVE_TYPES).toContain('Privileged');
  });
});
