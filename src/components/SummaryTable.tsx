import React from 'react';
import type { PeriodSummary } from '../types/cashflow';
import { formatIDR } from '../utils/cashflowPeriods';

interface SummaryTableProps {
  periods: PeriodSummary[];
  selectedPeriodKey: string | null;
  onSelectPeriod: (periodKey: string | null) => void;
}

export function SummaryTable({
  periods,
  selectedPeriodKey,
  onSelectPeriod,
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
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Tabel Ringkasan Arus Kas per Periode
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Saldo akhir tiap periode otomatis menjadi saldo awal periode berikutnya
          </p>
        </div>
        {selectedPeriodKey && (
          <button
            type="button"
            onClick={() => onSelectPeriod(null)}
            className="text-xs font-medium text-slate-700 hover:text-slate-900 underline underline-offset-4 self-start sm:self-auto cursor-pointer"
          >
            Tampilkan semua periode
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
              <th className="py-3 px-4 whitespace-nowrap">Periode Siklus</th>
              <th className="py-3 px-3 text-right whitespace-nowrap">Trx</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Saldo Awal</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Pemasukan</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Pengeluaran</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Arus Kas Bersih</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Saldo Akhir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {periods.map((period) => {
              const isSelected = selectedPeriodKey === period.periodKey;
              return (
                <tr
                  key={period.periodKey}
                  onClick={() => onSelectPeriod(isSelected ? null : period.periodKey)}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-100/90'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <div className="font-medium text-slate-900">{period.label}</div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-slate-500">
                    {period.transactionCount}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    {formatIDR(period.openingBalance)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                    {period.totalIncome > 0 ? `+${formatIDR(period.totalIncome)}` : formatIDR(0)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-red-700 whitespace-nowrap">
                    {period.totalExpense > 0 ? `-${formatIDR(period.totalExpense)}` : formatIDR(0)}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono tabular-nums font-medium whitespace-nowrap ${
                      period.netCashFlow > 0
                        ? 'text-emerald-700'
                        : period.netCashFlow < 0
                          ? 'text-red-700'
                          : 'text-slate-500'
                    }`}
                  >
                    {period.netCashFlow > 0 ? '+' : ''}
                    {formatIDR(period.netCashFlow)}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                      period.closingBalance < 0 ? 'text-red-700' : 'text-slate-900'
                    }`}
                  >
                    {formatIDR(period.closingBalance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900 text-white text-xs sm:text-sm font-semibold">
              <td className="py-3 px-4 whitespace-nowrap">Total & Saldo Akhir Horizon</td>
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
