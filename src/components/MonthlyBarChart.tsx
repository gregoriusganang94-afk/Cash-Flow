import React, { useMemo, useState } from 'react';
import type { PeriodSummary } from '../types/cashflow';
import { formatCompactIDR, formatIDR } from '../utils/cashflowPeriods';

type ChartMode = 'balances' | 'cashflow' | 'all';

interface MonthlyBarChartProps {
  periods: PeriodSummary[];
  selectedPeriodKey: string | null;
  isDark: boolean;
  onSelectPeriod: (periodKey: string | null) => void;
  onViewPeriodTransactions?: (periodKey: string) => void;
}

export function MonthlyBarChart({
  periods,
  selectedPeriodKey,
  isDark,
  onSelectPeriod,
  onViewPeriodTransactions,
}: MonthlyBarChartProps) {
  const [mode, setMode] = useState<ChartMode>('balances');
  const [hoveredPeriod, setHoveredPeriod] = useState<PeriodSummary | null>(null);

  const visiblePeriods = useMemo(() => periods.slice(0, 12), [periods]);

  const { minVal, maxVal } = useMemo(() => {
    let min = 0;
    let max = 0;
    for (const p of visiblePeriods) {
      const candidates =
        mode === 'balances'
          ? [p.openingBalance, p.closingBalance]
          : mode === 'cashflow'
            ? [p.totalIncome, p.totalExpense]
            : [p.openingBalance, p.totalIncome, p.totalExpense, p.closingBalance];
      for (const val of candidates) {
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }
    if (max === 0 && min === 0) {
      max = 10_000_000;
    } else {
      max = max * 1.12;
      min = min < 0 ? min * 1.12 : 0;
    }
    return { minVal: min, maxVal: max };
  }, [visiblePeriods, mode]);

  const svgWidth = 860;
  const svgHeight = 320;
  const padLeft = 82;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 48;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const valueRange = Math.max(1, maxVal - minVal);
  const yForValue = (val: number): number =>
    padTop + ((maxVal - val) / valueRange) * plotHeight;
  const zeroY = yForValue(0);

  const yTicks = useMemo(() => {
    const count = 4;
    const ticks: number[] = [];
    for (let i = 0; i <= count; i++) {
      ticks.push(minVal + (valueRange * i) / count);
    }
    return ticks;
  }, [minVal, valueRange]);

  const groupWidth = visiblePeriods.length > 0 ? plotWidth / visiblePeriods.length : plotWidth;

  const openingColor = isDark ? '#64748B' : '#94A3B8';
  const closingColor = isDark ? '#38BDF8' : '#0F172A';
  const incomeColor = isDark ? '#22C55E' : '#16A34A';
  const expenseColor = isDark ? '#EF4444' : '#DC2626';

  const seriesConfig =
    mode === 'balances'
      ? [
          { key: 'openingBalance' as const, label: 'Saldo Awal', color: openingColor },
          { key: 'closingBalance' as const, label: 'Saldo Akhir', color: closingColor },
        ]
      : mode === 'cashflow'
        ? [
            { key: 'totalIncome' as const, label: 'Pemasukan', color: incomeColor },
            { key: 'totalExpense' as const, label: 'Pengeluaran', color: expenseColor },
          ]
        : [
            { key: 'openingBalance' as const, label: 'Saldo Awal', color: openingColor },
            { key: 'totalIncome' as const, label: 'Pemasukan', color: incomeColor },
            { key: 'totalExpense' as const, label: 'Pengeluaran', color: expenseColor },
            { key: 'closingBalance' as const, label: 'Saldo Akhir', color: closingColor },
          ];

  const activePeriod =
    hoveredPeriod ||
    visiblePeriods.find((p) => p.periodKey === selectedPeriodKey) ||
    visiblePeriods[0];

  return (
    <section
      id="grafik-bulanan"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Grafik Batang Bulanan per Siklus
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pantau perbandingan saldo awal, saldo akhir, pemasukan, dan pengeluaran tiap periode
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode('balances')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'balances'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Saldo Awal vs Akhir
          </button>
          <button
            type="button"
            onClick={() => setMode('cashflow')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'cashflow'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Pemasukan vs Pengeluaran
          </button>
          <button
            type="button"
            onClick={() => setMode('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Semua Metrik
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          {seriesConfig.map((s) => (
            <div key={s.key} className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
              <span
                className="w-3 h-3 rounded-xs shrink-0"
                style={{ backgroundColor: s.color }}
                aria-hidden="true"
              />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
        <span className="text-slate-500 dark:text-slate-400">
          Klik batang periode untuk memilih siklus
        </span>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full min-w-[640px] h-auto select-none"
          role="img"
          aria-label="Grafik batang bulanan cash flow per siklus tanggal 25"
        >
          {yTicks.map((tickVal, idx) => {
            const y = yForValue(tickVal);
            const isZero = Math.abs(tickVal) < 1;
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke={
                    isZero
                      ? isDark
                        ? '#475569'
                        : '#94A3B8'
                      : isDark
                        ? '#1E293B'
                        : '#E2E8F0'
                  }
                  strokeWidth={isZero ? 1.2 : 1}
                  strokeDasharray={isZero ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono tabular-nums"
                >
                  {formatCompactIDR(tickVal)}
                </text>
              </g>
            );
          })}

          {visiblePeriods.map((period, pIdx) => {
            const groupX = padLeft + pIdx * groupWidth;
            const isSelected = selectedPeriodKey === period.periodKey;
            const isHovered = hoveredPeriod?.periodKey === period.periodKey;

            const innerPadding = Math.max(8, groupWidth * 0.16);
            const usableWidth = Math.max(12, groupWidth - innerPadding * 2);
            const gap = seriesConfig.length > 2 ? 3 : 5;
            const barWidth = Math.max(
              4,
              (usableWidth - gap * (seriesConfig.length - 1)) / seriesConfig.length
            );

            const columnFill = isSelected
              ? isDark
                ? '#1E293B'
                : '#F1F5F9'
              : isHovered
                ? isDark
                  ? '#0F172A'
                  : '#F8FAFC'
                : 'transparent';

            const columnStroke = isSelected
              ? isDark
                ? '#334155'
                : '#CBD5E1'
              : 'transparent';

            return (
              <g
                key={period.periodKey}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPeriod(period)}
                onMouseLeave={() => setHoveredPeriod(null)}
                onClick={() => onSelectPeriod(isSelected ? null : period.periodKey)}
              >
                <rect
                  x={groupX + 2}
                  y={padTop}
                  width={Math.max(4, groupWidth - 4)}
                  height={plotHeight}
                  rx={6}
                  fill={columnFill}
                  stroke={columnStroke}
                  strokeWidth={1}
                />

                {seriesConfig.map((series, sIdx) => {
                  const val = period[series.key];
                  const valY = yForValue(val);
                  const barTop = Math.min(zeroY, valY);
                  const barHeight = Math.max(val === 0 ? 1.5 : 3, Math.abs(zeroY - valY));
                  const barX = groupX + innerPadding + sIdx * (barWidth + gap);

                  return (
                    <rect
                      key={series.key}
                      x={barX}
                      y={barTop}
                      width={barWidth}
                      height={barHeight}
                      rx={2}
                      fill={series.color}
                      opacity={val === 0 ? 0.28 : isHovered || isSelected ? 1 : 0.9}
                    />
                  );
                })}

                <text
                  x={groupX + groupWidth / 2}
                  y={svgHeight - 20}
                  textAnchor="middle"
                  className={`text-[10px] font-medium ${
                    isSelected
                      ? 'fill-slate-900 dark:fill-slate-100 font-semibold'
                      : 'fill-slate-500 dark:fill-slate-400'
                  }`}
                >
                  {period.shortLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {activePeriod && (
        <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {activePeriod.label}
              <span className="font-normal text-slate-500 dark:text-slate-400 ml-2">
                ({activePeriod.transactionCount} transaksi)
              </span>
            </span>
            {onViewPeriodTransactions && (
              <button
                type="button"
                onClick={() => onViewPeriodTransactions(activePeriod.periodKey)}
                className="text-xs font-medium text-slate-800 dark:text-sky-400 underline underline-offset-4 hover:opacity-80 cursor-pointer"
              >
                Buka Transaksi Periode Ini
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-5 font-mono tabular-nums">
            <div>
              <span className="font-sans text-slate-500 dark:text-slate-400 mr-1.5">Saldo Awal:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {formatIDR(activePeriod.openingBalance)}
              </span>
            </div>
            <div>
              <span className="font-sans text-slate-500 dark:text-slate-400 mr-1.5">Pemasukan:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                +{formatIDR(activePeriod.totalIncome)}
              </span>
            </div>
            <div>
              <span className="font-sans text-slate-500 dark:text-slate-400 mr-1.5">Pengeluaran:</span>
              <span className="font-semibold text-red-700 dark:text-red-400">
                -{formatIDR(activePeriod.totalExpense)}
              </span>
            </div>
            <div>
              <span className="font-sans text-slate-500 dark:text-slate-400 mr-1.5">Saldo Akhir:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {formatIDR(activePeriod.closingBalance)}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
