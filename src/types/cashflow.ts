export type TransactionType = 'income' | 'expense';

export const BLUEPRINT_LIMITS = {
  MAX_CATEGORY_LEN: 60,
  MAX_DESCRIPTION_LEN: 200,
  MAX_REPO_LEN: 200,
  MAX_BRANCH_LEN: 100,
  MAX_FILEPATH_LEN: 200,
  MAX_AMOUNT: 1_000_000_000_000,
  MIN_CUTOFF_DAY: 1,
  MAX_CUTOFF_DAY: 28,
  DATE_PATTERN: /^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/,
  PERIOD_KEY_PATTERN: /^20[0-9]{2}-(0[1-9]|1[0-2])$/,
  REPO_PATTERN: /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/,
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
  baseOpeningBalance: number;
  startPeriodKey: string;
  cutoffDay: number;
  githubRepo: string;
  githubBranch: string;
  githubFilePath: string;
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
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  closingBalance: number;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
}

export interface GithubStatusResponse {
  authenticated: boolean;
  user: {
    login: string;
    name: string;
    avatarUrl: string;
    profileUrl: string;
  } | null;
  repos: Array<{
    fullName: string;
    defaultBranch: string;
    isPrivate: boolean;
    htmlUrl: string;
    updatedAt: string;
  }>;
}

export interface GithubInspectResponse {
  repository: {
    fullName: string;
    description: string | null;
    isPrivate: boolean;
    defaultBranch: string;
    htmlUrl: string;
    stars: number;
    updatedAt: string;
  };
  branch: string;
  filePath: string;
  file: {
    exists: boolean;
    sha: string | null;
    htmlUrl: string | null;
    size: number | null;
  };
  recentCommits: Array<{
    sha: string;
    message: string;
    author: string;
    date: string;
    htmlUrl: string;
  }>;
  canPush: boolean;
}
