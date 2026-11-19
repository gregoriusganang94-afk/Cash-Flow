import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  LayoutGrid,
  ListOrdered,
  LogOut,
  Moon,
  Plus,
  PlusCircle,
  Sun,
} from 'lucide-react';
import { MonthlyBarChart } from './components/MonthlyBarChart';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SummaryTable } from './components/SummaryTable';
import { TransactionForm } from './components/TransactionForm';
import { TransactionLedger } from './components/TransactionLedger';
import { useCashFlowStore, type TransactionInput } from './hooks/useCashFlowStore';
import { useTheme } from './hooks/useTheme';
import type { CashFlowTransaction } from './types/cashflow';
import { buildPeriodHorizon, formatDateID, formatIDR } from './utils/cashflowPeriods';

type ActiveWindow = 'ringkasan' | 'input' | 'grafik' | 'transaksi';

export default function App() {
  const { isDark, toggleTheme } = useTheme();
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
    updateCycleSettings,
  } = useCashFlowStore();

  const [activeWindow, setActiveWindow] = useState<ActiveWindow>('ringkasan');
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] =
    useState<CashFlowTransaction | null>(null);

  const activeSettings = useMemo(
    () =>
      settings || {
        userId: user?.uid || '',
        startPeriodKey: '2026-11',
        cutoffDay: 25,
      },
    [settings, user?.uid]
  );

  const periods = useMemo(
    () =>
      buildPeriodHorizon(
        transactions,
        activeSettings.startPeriodKey,
        activeSettings.cutoffDay,
        12
      ),
    [transactions, activeSettings.startPeriodKey, activeSettings.cutoffDay]
  );

  const kpiMetrics = useMemo(() => {
    const selected = selectedPeriodKey
      ? periods.find((p) => p.periodKey === selectedPeriodKey) || null
      : null;

    if (selected) {
      return {
        scopeLabel: selected.label,
        totalIncome: selected.totalIncome,
        totalExpense: selected.totalExpense,
        closingBalance: selected.closingBalance,
      };
    }

    const totalIncome = periods.reduce((sum, p) => sum + p.totalIncome, 0);
    const totalExpense = periods.reduce((sum, p) => sum + p.totalExpense, 0);

    return {
      scopeLabel:
        periods.length > 0
          ? `${periods[0].shortLabel} s/d ${periods[periods.length - 1].shortLabel}`
          : '12 Periode',
      totalIncome,
      totalExpense,
      closingBalance: totalIncome - totalExpense,
    };
  }, [periods, selectedPeriodKey]);

  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);

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
    setActiveWindow('input');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSwitchWindow = (target: ActiveWindow) => {
    setActiveWindow(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenPeriodTransactions = (periodKey: string) => {
    setSelectedPeriodKey(periodKey);
    handleSwitchWindow('transaksi');
  };

  const navItems: Array<{ id: ActiveWindow; label: string }> = [
    { id: 'ringkasan', label: 'Ringkasan' },
    { id: 'input', label: 'Input' },
    { id: 'grafik', label: 'Grafik Bulanan' },
    { id: 'transaksi', label: 'Transaksi' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Top Bar Contract: Exactly 3 zones separated by gap-8 */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => handleSwitchWindow('ringkasan')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            KasSiklus
          </button>

          {user ? (
            <nav
              aria-label="Navigasi menu utama"
              className="hidden md:flex items-center gap-6 text-sm font-medium"
            >
              {navItems.map((item) => {
                const isActive = activeWindow === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSwitchWindow(item.id)}
                    className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-semibold'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          ) : (
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500 dark:text-slate-400">
              <span className="whitespace-nowrap shrink-0">Siklus Tanggal 25</span>
              <span className="whitespace-nowrap shrink-0">Cloud Firestore</span>
              <span className="whitespace-nowrap shrink-0">Grafik Bulanan</span>
              <span className="whitespace-nowrap shrink-0">PWA Seluler</span>
            </div>
          )}

          <div className="shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => {
                  setEditingTransaction(null);
                  handleSwitchWindow('input');
                }}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Catat Transaksi
              </button>
            ) : (
              <button
                type="button"
                disabled={!authReady || authLoading}
                onClick={() => void signInWithGoogle()}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {authLoading ? 'Menghubungkan...' : 'Masuk dengan Google'}
              </button>
            )}
          </div>
        </div>
      </header>

      <OfflineIndicator />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20 md:pb-8 space-y-6">
        {!authReady ? (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[0, 1, 2].map((idx) => (
                <div
                  key={idx}
                  className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              ))}
            </div>
            <div className="h-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl" />
          </div>
        ) : !user ? (
          /* Unauthenticated Welcome / Sign-In Gate */
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 md:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Siklus Tanggal 25 · Firestore Database · PWA Siap Instal
                </span>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  {isDark ? 'Mode Terang' : 'Mode Gelap'}
                </button>
              </div>
              <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                Kelola Arus Kas Periode 25 November – 25 Desember dan Siklus Berikutnya
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                Catat pemasukan dan pengeluaran harian langsung dari HP atau desktop, dan pantau ringkasan saldo tiap periode sesuai tanggal transaksi secara otomatis di Firestore.
              </p>

              {authError && (
                <p className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
                  {authError}
                </p>
              )}

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => void signInWithGoogle()}
                  className="min-h-[44px] px-5 py-3 text-sm font-semibold text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {authLoading ? 'Membuka Google Sign-In...' : 'Masuk dengan Google untuk Mulai'}
                </button>
                <PWAInstallButton />
              </div>
            </div>

            <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Pola Siklus Otomatis Tanggal {activeSettings.cutoffDay}
              </h2>
              <div className="divide-y divide-slate-200 dark:divide-slate-700 text-xs">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Periode 1</span>
                  <span className="font-mono text-slate-600 dark:text-slate-400">25 Nov – 24 Des 2026</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Periode 2</span>
                  <span className="font-mono text-slate-600 dark:text-slate-400">25 Des &apos;26 – 24 Jan &apos;27</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Periode 3</span>
                  <span className="font-mono text-slate-600 dark:text-slate-400">25 Jan – 24 Feb 2027</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Perhitungan Periode</span>
                  <span className="text-slate-600 dark:text-slate-400">Pemasukan - Pengeluaran</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Authenticated Multi-Window Cash Flow Workspace */
          <>
            {/* Workspace Context Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {activeWindow === 'ringkasan' && `Ringkasan Cash Flow Siklus Tanggal ${activeSettings.cutoffDay}`}
                  {activeWindow === 'input' && 'Input Pemasukan & Pengeluaran'}
                  {activeWindow === 'grafik' && 'Grafik Batang Bulanan per Siklus'}
                  {activeWindow === 'transaksi' && 'Daftar Transaksi Firestore'}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span>{user.displayName || user.email}</span>
                  <span aria-hidden="true">·</span>
                  <span>Firestore aktif</span>
                  <span aria-hidden="true">·</span>
                  <span>Cakupan: {kpiMetrics.scopeLabel}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  <span>{isDark ? 'Terang' : 'Gelap'}</span>
                </button>
                <PWAInstallButton />
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Keluar
                </button>
              </div>
            </div>

            {dataLoading ? (
              <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[0, 1, 2].map((idx) => (
                    <div
                      key={idx}
                      className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  ))}
                </div>
                <div className="h-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>
            ) : (
              <>
                {/* WINDOW 1: RINGKASAN (KPI Cards + Summary Table) */}
                {activeWindow === 'ringkasan' && (
                  <div className="space-y-6">
                    <section
                      id="ringkasan"
                      className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"
                    >
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-1.5">
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Total Pemasukan
                        </div>
                        <div className="font-mono tabular-nums text-base sm:text-xl font-bold text-emerald-700 dark:text-emerald-400 truncate">
                          +{formatIDR(kpiMetrics.totalIncome)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Sesuai tanggal transaksi
                        </div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-1.5">
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Total Pengeluaran
                        </div>
                        <div className="font-mono tabular-nums text-base sm:text-xl font-bold text-red-700 dark:text-red-400 truncate">
                          -{formatIDR(kpiMetrics.totalExpense)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Sesuai tanggal transaksi
                        </div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-1.5">
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Saldo Akhir
                        </div>
                        <div
                          className={`font-mono tabular-nums text-base sm:text-xl font-bold truncate ${
                            kpiMetrics.closingBalance < 0
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {formatIDR(kpiMetrics.closingBalance)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Pemasukan - Pengeluaran
                        </div>
                      </div>
                    </section>

                    <SummaryTable
                      periods={periods}
                      selectedPeriodKey={selectedPeriodKey}
                      onSelectPeriod={setSelectedPeriodKey}
                      onOpenTransactions={handleOpenPeriodTransactions}
                    />
                  </div>
                )}

                {/* WINDOW 2: INPUT (Transaction Form + Quick Balance & Recent 5 Preview) */}
                {activeWindow === 'input' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-7">
                      <TransactionForm
                        settings={activeSettings}
                        editingTransaction={editingTransaction}
                        onCancelEdit={() => setEditingTransaction(null)}
                        onSubmitTransaction={handleSubmitTransaction}
                        onSaveCycleSettings={updateCycleSettings}
                      />
                    </div>

                    <aside className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
                      <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center justify-between gap-2">
                        <div>
                          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            Ringkasan &amp; Entri Terakhir
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Pembaruan otomatis ke Firestore
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSwitchWindow('transaksi')}
                          className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline underline-offset-4 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Semua ({transactions.length})
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg p-3.5">
                        <div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Pemasukan
                          </div>
                          <div className="font-mono tabular-nums text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5 truncate">
                            +{formatIDR(kpiMetrics.totalIncome)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Pengeluaran
                          </div>
                          <div className="font-mono tabular-nums text-xs sm:text-sm font-semibold text-red-700 dark:text-red-400 mt-0.5 truncate">
                            -{formatIDR(kpiMetrics.totalExpense)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Saldo Akhir
                          </div>
                          <div
                            className={`font-mono tabular-nums text-xs sm:text-sm font-bold mt-0.5 truncate ${
                              kpiMetrics.closingBalance < 0
                                ? 'text-red-700 dark:text-red-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {formatIDR(kpiMetrics.closingBalance)}
                          </div>
                        </div>
                      </div>

                      {recentTransactions.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                          Belum ada transaksi tercatat. Isi formulir di samping untuk memulai.
                        </p>
                      ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                          {recentTransactions.map((tx) => (
                            <li
                              key={tx.id}
                              onClick={() => handleEditSelect(tx)}
                              className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 -mx-2 rounded-lg transition-colors cursor-pointer"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                  {tx.description}
                                </div>
                                <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                                  {formatDateID(tx.date)} · {tx.category}
                                </div>
                              </div>
                              <div
                                className={`font-mono tabular-nums font-semibold whitespace-nowrap shrink-0 ${
                                  tx.type === 'income'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-red-700 dark:text-red-400'
                                }`}
                              >
                                {tx.type === 'income' ? '+' : '-'}
                                {formatIDR(tx.amount)}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </aside>
                  </div>
                )}

                {/* WINDOW 3: GRAFIK BULANAN */}
                {activeWindow === 'grafik' && (
                  <MonthlyBarChart
                    periods={periods}
                    selectedPeriodKey={selectedPeriodKey}
                    isDark={isDark}
                    onSelectPeriod={setSelectedPeriodKey}
                    onViewPeriodTransactions={handleOpenPeriodTransactions}
                  />
                )}

                {/* WINDOW 4: TRANSAKSI */}
                {activeWindow === 'transaksi' && (
                  <TransactionLedger
                    transactions={transactions}
                    periods={periods}
                    cutoffDay={activeSettings.cutoffDay}
                    selectedPeriodKey={selectedPeriodKey}
                    onSelectPeriod={setSelectedPeriodKey}
                    onEditTransaction={handleEditSelect}
                    onDeleteTransaction={deleteTransaction}
                    onGoToInput={() => {
                      setEditingTransaction(null);
                      handleSwitchWindow('input');
                    }}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (4 separate menu windows, 56px height) */}
      {user && (
        <nav
          aria-label="Navigasi menu seluler"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 items-center"
        >
          <button
            type="button"
            onClick={() => handleSwitchWindow('ringkasan')}
            className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] cursor-pointer transition-colors ${
              activeWindow === 'ringkasan'
                ? 'text-slate-900 dark:text-white font-semibold'
                : 'text-slate-500 dark:text-slate-400 font-medium'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Ringkasan</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchWindow('input')}
            className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] cursor-pointer transition-colors ${
              activeWindow === 'input'
                ? 'text-slate-900 dark:text-white font-semibold'
                : 'text-slate-500 dark:text-slate-400 font-medium'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Input</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchWindow('grafik')}
            className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] cursor-pointer transition-colors ${
              activeWindow === 'grafik'
                ? 'text-slate-900 dark:text-white font-semibold'
                : 'text-slate-500 dark:text-slate-400 font-medium'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Grafik</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchWindow('transaksi')}
            className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] cursor-pointer transition-colors ${
              activeWindow === 'transaksi'
                ? 'text-slate-900 dark:text-white font-semibold'
                : 'text-slate-500 dark:text-slate-400 font-medium'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>Transaksi</span>
          </button>
        </nav>
      )}

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-8 mb-14 md:mb-0">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>KasSiklus — Manajemen Arus Kas Siklus Tanggal 25</span>
          <span>Data tersinkronisasi real-time melalui Cloud Firestore</span>
        </div>
      </footer>
    </div>
  );
}
