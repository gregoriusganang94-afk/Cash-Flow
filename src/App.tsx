import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  GitBranch,
  LayoutGrid,
  LogOut,
  Plus,
  PlusCircle,
} from 'lucide-react';
import { GithubSyncPanel } from './components/GithubSyncPanel';
import { MonthlyBarChart } from './components/MonthlyBarChart';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SummaryTable } from './components/SummaryTable';
import { TransactionForm } from './components/TransactionForm';
import { TransactionLedger } from './components/TransactionLedger';
import { useCashFlowStore, type TransactionInput } from './hooks/useCashFlowStore';
import type { CashFlowTransaction } from './types/cashflow';
import { buildPeriodHorizon, formatIDR } from './utils/cashflowPeriods';

export default function App() {
  const {
    user,
    authReady,
    authLoading,
    authError,
    settings,
    transactions,
    dataLoading,
    signInWithGoogle,
    signOutUser,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    updateBalanceSettings,
    updateGithubSettings,
    importTransactionsBatch,
  } = useCashFlowStore();

  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] =
    useState<CashFlowTransaction | null>(null);

  const activeSettings = useMemo(
    () =>
      settings || {
        userId: user?.uid || '',
        baseOpeningBalance: 0,
        startPeriodKey: '2026-11',
        cutoffDay: 25,
        githubRepo: '',
        githubBranch: 'main',
        githubFilePath: 'cashflow/ledger.json',
      },
    [settings, user?.uid]
  );

  const periods = useMemo(
    () =>
      buildPeriodHorizon(
        transactions,
        activeSettings.baseOpeningBalance,
        activeSettings.startPeriodKey,
        activeSettings.cutoffDay,
        12
      ),
    [
      transactions,
      activeSettings.baseOpeningBalance,
      activeSettings.startPeriodKey,
      activeSettings.cutoffDay,
    ]
  );

  const kpiMetrics = useMemo(() => {
    const selected = selectedPeriodKey
      ? periods.find((p) => p.periodKey === selectedPeriodKey) || null
      : null;

    if (selected) {
      return {
        scopeLabel: selected.label,
        openingBalance: selected.openingBalance,
        totalIncome: selected.totalIncome,
        totalExpense: selected.totalExpense,
        closingBalance: selected.closingBalance,
      };
    }

    const totalIncome = periods.reduce((sum, p) => sum + p.totalIncome, 0);
    const totalExpense = periods.reduce((sum, p) => sum + p.totalExpense, 0);
    const firstOpening =
      periods.length > 0 ? periods[0].openingBalance : activeSettings.baseOpeningBalance;
    const lastClosing =
      periods.length > 0 ? periods[periods.length - 1].closingBalance : firstOpening;

    return {
      scopeLabel:
        periods.length > 0
          ? `${periods[0].shortLabel} s/d ${periods[periods.length - 1].shortLabel}`
          : '12 Periode',
      openingBalance: firstOpening,
      totalIncome,
      totalExpense,
      closingBalance: lastClosing,
    };
  }, [periods, selectedPeriodKey, activeSettings.baseOpeningBalance]);

  const handleSubmitTransaction = async (
    input: TransactionInput,
    editingId?: string
  ) => {
    if (editingId) {
      await updateTransaction(editingId, input);
    } else {
      await addTransaction(input);
    }
  };

  const handleEditSelect = (tx: CashFlowTransaction) => {
    setEditingTransaction(tx);
    const el = document.getElementById('input-transaksi');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: Exactly 3 zones separated by gap-8 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            KasSiklus
          </a>

          <nav
            aria-label="Navigasi utama"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#ringkasan"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Ringkasan
            </a>
            <a
              href="#grafik-bulanan"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Grafik Bulanan
            </a>
            <a
              href="#tabel-ringkasan"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Tabel Periode
            </a>
            <a
              href="#daftar-transaksi"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Transaksi
            </a>
            <a
              href="#github-sync"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              GitHub Sync
            </a>
          </nav>

          <div className="shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => scrollToSection('input-transaksi')}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Catat Transaksi
              </button>
            ) : (
              <button
                type="button"
                disabled={!authReady || authLoading}
                onClick={() => void signInWithGoogle()}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {authLoading ? 'Menghubungkan...' : 'Masuk dengan Google'}
              </button>
            )}
          </div>
        </div>
      </header>

      <OfflineIndicator />

      <main
        id="top"
        className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20 md:pb-8 space-y-6"
      >
        {!authReady ? (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="h-24 bg-white border border-slate-200 rounded-xl"
                />
              ))}
            </div>
            <div className="h-96 bg-white border border-slate-200 rounded-xl" />
          </div>
        ) : !user ? (
          /* Unauthenticated Landing / Sign-In Workspace Gate */
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 md:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="text-xs font-medium text-slate-500">
                Siklus Tanggal 25 · Firestore Database · PWA Siap Instal
              </div>
              <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance">
                Kelola Arus Kas Periode 25 November – 25 Desember dan Siklus Berikutnya
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
                Catat pemasukan dan pengeluaran harian langsung dari HP atau desktop, pantau carry-over saldo awal hingga saldo akhir antar periode di Firestore, dan cadangkan ledger ke GitHub.
              </p>

              {authError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {authError}
                </p>
              )}

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => void signInWithGoogle()}
                  className="min-h-[44px] px-5 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {authLoading ? 'Membuka Google Sign-In...' : 'Masuk dengan Google untuk Mulai'}
                </button>
                <PWAInstallButton />
              </div>
            </div>

            <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Pola Siklus Otomatis Tanggal {activeSettings.cutoffDay}
              </h2>
              <div className="divide-y divide-slate-200 text-xs">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="font-medium text-slate-700">Periode 1</span>
                  <span className="font-mono text-slate-600">25 Nov – 24 Des 2026</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="font-medium text-slate-700">Periode 2</span>
                  <span className="font-mono text-slate-600">25 Des &apos;26 – 24 Jan &apos;27</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="font-medium text-slate-700">Periode 3</span>
                  <span className="font-mono text-slate-600">25 Jan – 24 Feb 2027</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="font-medium text-slate-700">Carry-over Saldo</span>
                  <span className="text-slate-600">Saldo Akhir &rarr; Saldo Awal</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Authenticated Cash Flow Workspace */
          <>
            {/* Workspace Context Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  Dasbor Cash Flow Siklus Tanggal {activeSettings.cutoffDay}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                  <span>{user.displayName || user.email}</span>
                  <span aria-hidden="true">·</span>
                  <span>Firestore aktif</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {activeSettings.githubRepo
                      ? `Repo: ${activeSettings.githubRepo}`
                      : 'Repo GitHub belum ditautkan'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Cakupan: {kpiMetrics.scopeLabel}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <PWAInstallButton />
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Keluar
                </button>
              </div>
            </div>

            {dataLoading ? (
              <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className="h-24 bg-white border border-slate-200 rounded-xl"
                    />
                  ))}
                </div>
                <div className="h-80 bg-white border border-slate-200 rounded-xl" />
              </div>
            ) : (
              <>
                {/* 4-Column KPI Summary Strip */}
                <section
                  id="ringkasan"
                  className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
                >
                  <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-1.5">
                    <div className="text-xs font-medium text-slate-500">
                      Total Saldo Awal
                    </div>
                    <div className="font-mono tabular-nums text-base sm:text-xl font-bold text-slate-900 truncate">
                      {formatIDR(kpiMetrics.openingBalance)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {selectedPeriodKey
                        ? 'Carry-over periode terpilih'
                        : 'Saldo awal dasar'}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-1.5">
                    <div className="text-xs font-medium text-slate-500">
                      Total Pemasukan
                    </div>
                    <div className="font-mono tabular-nums text-base sm:text-xl font-bold text-emerald-700 truncate">
                      +{formatIDR(kpiMetrics.totalIncome)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Akumulasi masuk
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-1.5">
                    <div className="text-xs font-medium text-slate-500">
                      Total Pengeluaran
                    </div>
                    <div className="font-mono tabular-nums text-base sm:text-xl font-bold text-red-700 truncate">
                      -{formatIDR(kpiMetrics.totalExpense)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Akumulasi keluar
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-1.5">
                    <div className="text-xs font-medium text-slate-500">
                      Saldo Akhir
                    </div>
                    <div
                      className={`font-mono tabular-nums text-base sm:text-xl font-bold truncate ${
                        kpiMetrics.closingBalance < 0 ? 'text-red-700' : 'text-slate-900'
                      }`}
                    >
                      {formatIDR(kpiMetrics.closingBalance)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Awal + Masuk - Keluar
                    </div>
                  </div>
                </section>

                {/* Primary Workspace Split: Transaction Form + Monthly Bar Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-4">
                    <TransactionForm
                      settings={activeSettings}
                      editingTransaction={editingTransaction}
                      onCancelEdit={() => setEditingTransaction(null)}
                      onSubmitTransaction={handleSubmitTransaction}
                      onSaveBalanceSettings={updateBalanceSettings}
                    />
                  </div>
                  <div className="lg:col-span-8">
                    <MonthlyBarChart
                      periods={periods}
                      selectedPeriodKey={selectedPeriodKey}
                      onSelectPeriod={setSelectedPeriodKey}
                    />
                  </div>
                </div>

                {/* Period Summary Table */}
                <SummaryTable
                  periods={periods}
                  selectedPeriodKey={selectedPeriodKey}
                  onSelectPeriod={setSelectedPeriodKey}
                />

                {/* Firestore Transaction Ledger */}
                <TransactionLedger
                  transactions={transactions}
                  periods={periods}
                  cutoffDay={activeSettings.cutoffDay}
                  selectedPeriodKey={selectedPeriodKey}
                  onSelectPeriod={setSelectedPeriodKey}
                  onEditTransaction={handleEditSelect}
                  onDeleteTransaction={deleteTransaction}
                />

                {/* GitHub Repository Integration Panel */}
                <GithubSyncPanel
                  settings={activeSettings}
                  transactions={transactions}
                  periods={periods}
                  onSaveGithubSettings={updateGithubSettings}
                  onImportTransactions={importTransactionsBatch}
                />
              </>
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (thumb zone, compact 56px height) */}
      {user && (
        <nav
          aria-label="Navigasi cepat seluler"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-4 items-center"
        >
          <button
            type="button"
            onClick={() => scrollToSection('ringkasan')}
            className="h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Ringkasan</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('input-transaksi')}
            className="h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Input</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('grafik-bulanan')}
            className="h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Grafik</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('github-sync')}
            className="h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            <GitBranch className="w-4 h-4" />
            <span>GitHub</span>
          </button>
        </nav>
      )}

      <footer className="border-t border-slate-200 bg-white mt-12 mb-14 md:mb-0">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>KasSiklus — Manajemen Arus Kas Siklus Tanggal 25</span>
          <span>Data tersinkronisasi melalui Cloud Firestore &amp; GitHub API</span>
        </div>
      </footer>
    </div>
  );
}
