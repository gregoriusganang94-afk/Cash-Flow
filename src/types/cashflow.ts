export type TransactionType = 'income' | 'expense';

export const BLUEPRINT_LIMITS = {
  MAX_CATEGORY_LEN: 60,
  MAX_DESCRIPTION_LEN: 200,
  MAX_AMOUNT: 1_000_000_000_000,
  MIN_CUTOFF_DAY: 1,
  MAX_CUTOFF_DAY: 28,
  DATE_PATTERN: /^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/,
  PERIOD_KEY_PATTERN: /^20[0-9]{2}-(0[1-9]|1[0-2])$/,
} as const;

export const INCOME_CATEGORIES = [
  'Gaji & Tunjangan',
  'Bonus & THR',
  'Freelance & Proyek',
  'Penjualan & Bisnis',
  'Dividen & Investasi',
  'Lainnya',
] as const;

export const EXPENSE_CATEGORIES = [
  'Kebutuhan Pokok',
  'Tagihan & Utilitas',
  'Tempat Tinggal',
  'Transportasi',
  'Cicilan & Pinjaman',
  'Tabungan & Investasi',
  'Hiburan & Gaya Hidup',
  'Operasional & Lainnya',
] as const;

export interface UserSettings {
  userId: string;
  startPeriodKey: string;
  cutoffDay: number;
}

export interface CashFlowTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
  periodKey: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PeriodSummary {
  periodKey: string;
  label: string;
  shortLabel: string;
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  closingBalance: number;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
}
