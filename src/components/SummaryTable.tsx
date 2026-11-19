import React from 'react';
import type { PeriodSummary } from '../types/cashflow';
import { formatIDR } from '../utils/cashflowPeriods';

interface SummaryTableProps {
  periods: PeriodSummary[];
  selectedPeriodKey: string | null;
  onSelectPeriod: (periodKey: string | null) => void;
  onOpenTransactions?: (periodKey: string) => void;
}

export function SummaryTable({
  periods,
  selectedPeriodKey,
  onSelectPeriod,
  onOpenTransactions,
}: SummaryTableProps) {
  const firstOpeningBalance = periods.length > 0 ? periods[0].openingBalance : 0;
  const lastClosingBalance =
    periods.length > 0 ? periods[periods.length - 1].closingBalance : 0;

  const totals = periods.reduce(
    (acc, p) => ({
      income: acc.income + p.totalIncome,
      expense: acc.expense + p.totalExpense,
      net: acc.net + p.netCashFlow,
      txCount: acc.txCount + p.transactionCount,
    }),
    { income: 0, expense: 0, net: 0, txCount: 0 }
  );

  return (
    <section
      id="tabel-ringkasan"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
    >
      <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Tabel Ringkasan Arus Kas per Periode
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Saldo akhir tiap periode otomatis menjadi saldo awal periode berikutnya
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {selectedPeriodKey && onOpenTransactions && (
            <button
              type="button"
              onClick={() => onOpenTransactions(selectedPeriodKey)}
              className="text-xs font-semibold text-slate-900 dark:text-sky-400 underline underline-offset-4 cursor-pointer"
            >
              Lihat Transaksi Periode
            </button>
          )}
          {selectedPeriodKey && (
            <button
              type="button"
              onClick={() => onSelectPeriod(null)}
              className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline underline-offset-4 cursor-pointer"
            >
              Reset filter
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <th className="py-3 px-4 whitespace-nowrap">Periode Siklus</th>
              <th className="py-3 px-3 text-right whitespace-nowrap">Trx</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Saldo Awal</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Pemasukan</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Pengeluaran</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Arus Kas Bersih</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Saldo Akhir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {periods.map((period) => {
              const isSelected = selectedPeriodKey === period.periodKey;
              return (
                <tr
                  key={period.periodKey}
                  onClick={() => onSelectPeriod(isSelected ? null : period.periodKey)}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-100/90 dark:bg-slate-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{period.label}</div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                    {period.transactionCount}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {formatIDR(period.openingBalance)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    {period.totalIncome > 0 ? `+${formatIDR(period.totalIncome)}` : formatIDR(0)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-red-700 dark:text-red-400 whitespace-nowrap">
                    {period.totalExpense > 0 ? `-${formatIDR(period.totalExpense)}` : formatIDR(0)}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono tabular-nums font-medium whitespace-nowrap ${
                      period.netCashFlow > 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : period.netCashFlow < 0
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {period.netCashFlow > 0 ? '+' : ''}
                    {formatIDR(period.netCashFlow)}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                      period.closingBalance < 0
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {formatIDR(period.closingBalance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900 dark:bg-slate-800 text-white text-xs sm:text-sm font-semibold border-t border-slate-800 dark:border-slate-700">
              <td className="py-3 px-4 whitespace-nowrap">Total &amp; Saldo Akhir Horizon</td>
              <td className="py-3 px-3 text-right font-mono tabular-nums">{totals.txCount}</td>
              <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                {formatIDR(firstOpeningBalance)}
              </td>
              <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-300 whitespace-nowrap">
                +{formatIDR(totals.income)}
              </td>
              <td className="py-3 px-4 text-right font-mono tabular-nums text-red-300 whitespace-nowrap">
                -{formatIDR(totals.expense)}
              </td>
              <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                {totals.net > 0 ? '+' : ''}
                {formatIDR(totals.net)}
              </td>
              <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                {formatIDR(lastClosingBalance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
