import type { LifeDate } from './types.js';

const MS_PER_DAY = 86_400_000;

export const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
] as const;

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatYMD(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

export function todayLocalISO(now: Date = new Date()): string {
  return formatYMD(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function isValidISODate(dateStr: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function parseISODateParts(dateStr: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (!match) {
    throw new Error(`Invalid ISO date string: "${dateStr}"`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Out-of-range ISO calendar date: "${dateStr}"`);
  }
  return { year, month, day };
}

export function toEpochDay(dateStr: string): number {
  const { year, month, day } = parseISODateParts(dateStr);
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function fromEpochDay(epochDay: number): string {
  const d = new Date(epochDay * MS_PER_DAY);
  return formatYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addCalendarDays(dateStr: string, deltaDays: number): string {
  return fromEpochDay(toEpochDay(dateStr) + deltaDays);
}

export function diffCalendarDays(earlierDateStr: string, laterDateStr: string): number {
  return toEpochDay(laterDateStr) - toEpochDay(earlierDateStr);
}

export function dayOfWeekUTC(dateStr: string): number {
  const { year, month, day } = parseISODateParts(dateStr);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

export function clampDayToMonth(year: number, month: number, day: number): number {
  return Math.min(Math.max(1, day), daysInMonth(year, month));
}

export function formatShortMonthDay(
  month: number,
  day: number,
  year?: number | null
): string {
  const monthLabel = SHORT_MONTH_NAMES[month - 1] ?? 'Jan';
  if (year != null) {
    return `${monthLabel} ${day}, ${year}`;
  }
  return `${monthLabel} ${day}`;
}

export function formatShortISODate(dateStr: string, includeYear = false): string {
  const { year, month, day } = parseISODateParts(dateStr);
  return formatShortMonthDay(month, day, includeYear ? year : null);
}

export function daysUntilLifeDate(
  lifeDate: Pick<LifeDate, 'dateMonth' | 'dateDay' | 'dateYear' | 'recurringAnnual'>,
  referenceDateStr: string
): number | null {
  const ref = parseISODateParts(referenceDateStr);

  if (lifeDate.recurringAnnual) {
    const dayThisYear = clampDayToMonth(ref.year, lifeDate.dateMonth, lifeDate.dateDay);
    const thisYearStr = formatYMD(ref.year, lifeDate.dateMonth, dayThisYear);
    const diffThisYear = diffCalendarDays(referenceDateStr, thisYearStr);
    if (diffThisYear >= 0) {
      return diffThisYear;
    }

    const nextYear = ref.year + 1;
    const dayNextYear = clampDayToMonth(nextYear, lifeDate.dateMonth, lifeDate.dateDay);
    const nextYearStr = formatYMD(nextYear, lifeDate.dateMonth, dayNextYear);
    return diffCalendarDays(referenceDateStr, nextYearStr);
  }

  if (lifeDate.dateYear == null) {
    return null;
  }

  const clampedDay = clampDayToMonth(
    lifeDate.dateYear,
    lifeDate.dateMonth,
    lifeDate.dateDay
  );
  const targetStr = formatYMD(lifeDate.dateYear, lifeDate.dateMonth, clampedDay);
  return diffCalendarDays(referenceDateStr, targetStr);
}
