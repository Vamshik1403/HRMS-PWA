const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Month/year for Payout filter — uses cycle end date when period is a range. */
export function parsePayslipFilterMonthYear(
  period: string,
): { month: number; year: number } | null {
  if (!period?.trim()) return null;
  const segment = period.includes(' to ')
    ? period.split(' to ').pop()!.trim()
    : period.trim();

  for (let i = 0; i < MONTHS.length; i++) {
    if (segment.includes(MONTHS[i])) {
      const yearMatch = segment.match(/\d{4}/);
      const year = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();
      return { month: i + 1, year };
    }
  }
  return null;
}

export function empPayoutHrefForPeriod(monthPeriod: string): string {
  const parsed = parsePayslipFilterMonthYear(monthPeriod);
  if (!parsed) return '/empPayout';
  return `/empPayout?month=${parsed.month}&year=${parsed.year}`;
}
