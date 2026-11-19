import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Eye,
  LayoutGrid,
  ListOrdered,
  Moon,
  Sun,
} from 'lucide-react';
import { useSharedCashFlow } from '../hooks/useSharedCashFlow';
import { buildPeriodHorizon, formatIDR } from '../utils/cashflowPeriods';
import { MonthlyBarChart } from './MonthlyBarChart';
import { OfflineIndicator } from './OfflineIndicator';
import { SummaryTable } from './SummaryTable';
import { TransactionLedger } from './TransactionLedger';

type SharedWindow = 'ringkasan' | 'grafik' | 'transaksi';

interface SharedViewProps {
  shareId: string;
  isDark: boolean;
  onToggleTheme: () => void;
  onExitShareMode: () => void;
}

export function SharedView({
  shareId,
  isDark,
  onToggleTheme,
  onExitShareMode,
}: SharedViewProps) {
  const { loading, errorMessage, snapshot, transactions } = useSharedCashFlow(shareId);
  const [activeWindow, setActiveWindow] = useState<SharedWindow>('ringkasan');
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null);

  const periods = useMemo(() => {
    if (!snapshot) return [];
    return buildPeriodHorizon(
      transactions,
      snapshot.startPeriodKey,
      snapshot.cutoffDay,
      12
    );
  }, [snapshot, transactions]);

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

  const handleSwitchWindow = (target: SharedWindow) => {
    setActiveWindow(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenPeriodTransactions = (periodKey: string) => {
    setSelectedPeriodKey(periodKey);
    handleSwitchWindow('transaksi');
  };

  const navItems: Array<{ id: SharedWindow; label: string }> = [
    { id: 'ringkasan', label: 'Ringkasan' },
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

          {snapshot ? (
            <nav
              aria-label="Navigasi menu laporan bersama"
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
              <span className="whitespace-nowrap shrink-0">Laporan Read-Only</span>
            </div>
          )}

          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={onExitShareMode}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kelola Akun Saya
            </button>
          </div>
        </div>
      </header>

      <OfflineIndicator />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20 md:pb-8 space-y-6">
        {loading ? (
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
        ) : errorMessage || !snapshot ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-4 max-w-xl mx-auto mt-6">
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Tautan Tidak Tersedia
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {errorMessage || 'Tautan laporan ini tidak ditemukan atau sudah dinonaktifkan.'}
            </p>
            <button
              type="button"
              onClick={onExitShareMode}
              className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors cursor-pointer"
            >
              Buka Aplikasi Utama
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {snapshot.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                    <Eye className="w-3.5 h-3.5" />
                    Mode Lihat Saja (Read-Only)
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Siklus Tanggal {snapshot.cutoffDay}</span>
                  <span aria-hidden="true">·</span>
                  <span>Cakupan: {kpiMetrics.scopeLabel}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={onToggleTheme}
                  aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  <span>{isDark ? 'Terang' : 'Gelap'}</span>
                </button>
              </div>
            </div>

            {activeWindow === 'ringkasan' && (
              <div className="space-y-6">
                <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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

            {activeWindow === 'grafik' && (
              <MonthlyBarChart
                periods={periods}
                selectedPeriodKey={selectedPeriodKey}
                isDark={isDark}
                onSelectPeriod={setSelectedPeriodKey}
                onViewPeriodTransactions={handleOpenPeriodTransactions}
              />
            )}

            {activeWindow === 'transaksi' && (
              <TransactionLedger
                transactions={transactions}
                periods={periods}
                cutoffDay={snapshot.cutoffDay}
                selectedPeriodKey={selectedPeriodKey}
                readOnly
                onSelectPeriod={setSelectedPeriodKey}
              />
            )}
          </>
        )}
      </main>

      {snapshot && (
        <nav
          aria-label="Navigasi menu laporan seluler"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 items-center"
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
          <span>KasSiklus — Tampilan Read-Only</span>
          <span>Data tersinkronisasi melalui Cloud Firestore</span>
        </div>
      </footer>
    </div>
  );
}
