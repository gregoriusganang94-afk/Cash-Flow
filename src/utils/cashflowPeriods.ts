import type { CashFlowTransaction, PeriodSummary } from '../types/cashflow';

const MONTHS_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Ags',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function parsePeriodKey(periodKey: string): { year: number; month: number } {
  const [yStr, mStr] = periodKey.split('-');
  return {
    year: Number(yStr) || 2026,
    month: Number(mStr) || 11,
  };
}

export function addMonthsToPeriodKey(periodKey: string, deltaMonths: number): string {
  const { year, month } = parsePeriodKey(periodKey);
  const totalMonths = year * 12 + (month - 1) + deltaMonths;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = ((totalMonths % 12) + 12) % 12 + 1;
  return `${nextYear}-${pad2(nextMonth)}`;
}

export function comparePeriodKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Maps an ISO date (YYYY-MM-DD) to its cycle periodKey (YYYY-MM) using cutoffDay (default 25).
 * Example (cutoffDay = 25):
 * - 2026-11-25 .. 2026-12-24 -> "2026-11" (25 Nov – 24 Des 2026)
 * - 2026-12-25 .. 2027-01-24 -> "2026-12" (25 Des 2026 – 24 Jan 2027)
 */
export function getPeriodKeyForDate(dateStr: string, cutoffDay = 25): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return '2026-11';
  }
  const [year, month, day] = parts;
  if (day >= cutoffDay) {
    return `${year}-${pad2(month)}`;
  }
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${pad2(month - 1)}`;
}

export function getPeriodRange(
  periodKey: string,
  cutoffDay = 25
): {
  startDate: string;
  endDate: string;
  label: string;
  shortLabel: string;
} {
  const { year, month } = parsePeriodKey(periodKey);
  const nextKey = addMonthsToPeriodKey(periodKey, 1);
  const { year: nextYear, month: nextMonth } = parsePeriodKey(nextKey);

  const startDay = cutoffDay;
  const endDay = cutoffDay === 1 ? daysInMonth(year, month) : cutoffDay - 1;
  const endYear = cutoffDay === 1 ? year : nextYear;
  const endMonth = cutoffDay === 1 ? month : nextMonth;

  const startDate = `${year}-${pad2(month)}-${pad2(startDay)}`;
  const endDate = `${endYear}-${pad2(endMonth)}-${pad2(endDay)}`;

  const m1Name = MONTHS_SHORT_ID[month - 1] || 'Nov';
  const m2Name = MONTHS_SHORT_ID[endMonth - 1] || 'Des';

  const label =
    year === endYear
      ? `${startDay} ${m1Name} – ${endDay} ${m2Name} ${year}`
      : `${startDay} ${m1Name} '${String(year).slice(-2)} – ${endDay} ${m2Name} '${String(endYear).slice(-2)}`;

  const shortLabel =
    year === endYear
      ? `${m1Name}–${m2Name} '${String(year).slice(-2)}`
      : `${m1Name}'${String(year).slice(-2)}–${m2Name}'${String(endYear).slice(-2)}`;

  return {
    startDate,
    endDate,
    label,
    shortLabel,
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function buildPeriodHorizon(
  transactions: CashFlowTransaction[],
  baseOpeningBalance: number,
  startPeriodKey: string,
  cutoffDay = 25,
  minMonths = 12
): PeriodSummary[] {
  let firstKey = startPeriodKey;
  let lastKey = addMonthsToPeriodKey(startPeriodKey, minMonths - 1);

  for (const tx of transactions) {
    const key = getPeriodKeyForDate(tx.date, cutoffDay);
    if (comparePeriodKeys(key, firstKey) < 0) {
      firstKey = key;
    }
    if (comparePeriodKeys(key, lastKey) > 0) {
      lastKey = key;
    }
  }

  const keys: string[] = [];
  let cursor = firstKey;
  let guard = 0;
  while (comparePeriodKeys(cursor, lastKey) <= 0 && guard < 60) {
    keys.push(cursor);
    cursor = addMonthsToPeriodKey(cursor, 1);
    guard += 1;
  }

  const grouped = new Map<
    string,
    { income: number; expense: number; incomeCount: number; expenseCount: number }
  >();
  for (const tx of transactions) {
    const key = getPeriodKeyForDate(tx.date, cutoffDay);
    const bucket = grouped.get(key) || {
      income: 0,
      expense: 0,
      incomeCount: 0,
      expenseCount: 0,
    };
    if (tx.type === 'income') {
      bucket.income += tx.amount;
      bucket.incomeCount += 1;
    } else {
      bucket.expense += tx.amount;
      bucket.expenseCount += 1;
    }
    grouped.set(key, bucket);
  }

  let runningBalance = baseOpeningBalance;
  return keys.map((periodKey) => {
    const bucket = grouped.get(periodKey) || {
      income: 0,
      expense: 0,
      incomeCount: 0,
      expenseCount: 0,
    };
    const range = getPeriodRange(periodKey, cutoffDay);
    const openingBalance = runningBalance;
    const netCashFlow = bucket.income - bucket.expense;
    const closingBalance = openingBalance + netCashFlow;
    runningBalance = closingBalance;

    return {
      periodKey,
      label: range.label,
      shortLabel: range.shortLabel,
      startDate: range.startDate,
      endDate: range.endDate,
      openingBalance,
      totalIncome: bucket.income,
      totalExpense: bucket.expense,
      netCashFlow,
      closingBalance,
      transactionCount: bucket.incomeCount + bucket.expenseCount,
      incomeCount: bucket.incomeCount,
      expenseCount: bucket.expenseCount,
    };
  });
}

const IDR_FORMATTER = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function formatIDR(amount: number): string {
  return IDR_FORMATTER.format(Math.round(amount));
}

export function formatCompactIDR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace('.', ',')} jt`;
  }
  if (abs >= 1_000) {
    return `${sign}Rp ${(abs / 1_000).toFixed(0)} rb`;
  }
  return `${sign}Rp ${Math.round(abs)}`;
}

export function formatDateID(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} ${MONTHS_SHORT_ID[m - 1] || ''} ${y}`;
}
