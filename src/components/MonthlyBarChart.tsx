import React, { useMemo, useState } from 'react';
import type { PeriodSummary } from '../types/cashflow';
import { formatCompactIDR, formatIDR } from '../utils/cashflowPeriods';

type ChartMode = 'balances' | 'cashflow' | 'all';

interface MonthlyBarChartProps {
  periods: PeriodSummary[];
  selectedPeriodKey: string | null;
  onSelectPeriod: (periodKey: string | null) => void;
}

export function MonthlyBarChart({
  periods,
  selectedPeriodKey,
  onSelectPeriod,
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

  const seriesConfig =
    mode === 'balances'
      ? [
          { key: 'openingBalance' as const, label: 'Saldo Awal', color: '#94A3B8' },
          { key: 'closingBalance' as const, label: 'Saldo Akhir', color: '#0F172A' },
        ]
      : mode === 'cashflow'
        ? [
            { key: 'totalIncome' as const, label: 'Pemasukan', color: '#16A34A' },
            { key: 'totalExpense' as const, label: 'Pengeluaran', color: '#DC2626' },
          ]
        : [
            { key: 'openingBalance' as const, label: 'Saldo Awal', color: '#94A3B8' },
            { key: 'totalIncome' as const, label: 'Pemasukan', color: '#16A34A' },
            { key: 'totalExpense' as const, label: 'Pengeluaran', color: '#DC2626' },
            { key: 'closingBalance' as const, label: 'Saldo Akhir', color: '#0F172A' },
          ];

  return (
    <section
      id="grafik-bulanan"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Grafik Batang Bulanan per Siklus
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantau perbandingan saldo awal, saldo akhir, pemasukan, dan pengeluaran tiap periode
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode('balances')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'balances'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Saldo Awal vs Akhir
          </button>
          <button
            type="button"
            onClick={() => setMode('cashflow')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'cashflow'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pemasukan vs Pengeluaran
          </button>
          <button
            type="button"
            onClick={() => setMode('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua Metrik
          </button>
        </div>
      </div>

      {/* Legend + Active Period Inspector */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          {seriesConfig.map((s) => (
            <div key={s.key} className="inline-flex items-center gap-2 text-slate-700 font-medium">
              <span
                className="w-3 h-3 rounded-xs shrink-0"
                style={{ backgroundColor: s.color }}
                aria-hidden="true"
              />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
        <span className="text-slate-500">
          Klik batang periode untuk memfilter daftar transaksi
        </span>
      </div>

      {/* Interactive Chart Viewport */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full min-w-[640px] h-auto select-none"
          role="img"
          aria-label="Grafik batang bulanan cash flow per siklus tanggal 25"
        >
          {/* Gridlines & Y Axis Ticks */}
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
                  stroke={isZero ? '#94A3B8' : '#E2E8F0'}
                  strokeWidth={isZero ? 1.2 : 1}
                  strokeDasharray={isZero ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 text-[10px] font-mono tabular-nums"
                >
                  {formatCompactIDR(tickVal)}
                </text>
              </g>
            );
          })}

          {/* Period Bar Groups */}
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

            return (
              <g
                key={period.periodKey}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPeriod(period)}
                onMouseLeave={() => setHoveredPeriod(null)}
                onClick={() =>
                  onSelectPeriod(isSelected ? null : period.periodKey)
                }
              >
                {/* Hover/Selection Column Backdrop */}
                <rect
                  x={groupX + 2}
                  y={padTop}
                  width={Math.max(4, groupWidth - 4)}
                  height={plotHeight}
                  rx={6}
                  fill={isSelected ? '#F1F5F9' : isHovered ? '#F8FAFC' : 'transparent'}
                  stroke={isSelected ? '#CBD5E1' : 'transparent'}
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

                {/* X-Axis Period Label */}
                <text
                  x={groupX + groupWidth / 2}
                  y={svgHeight - 20}
                  textAnchor="middle"
                  className={`text-[10px] font-medium ${
                    isSelected ? 'fill-slate-900 font-semibold' : 'fill-slate-500'
                  }`}
                >
                  {period.shortLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Live Inspection Strip below chart (prevents clipped tooltips) */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
        {(() => {
          const active =
            hoveredPeriod ||
            visiblePeriods.find((p) => p.periodKey === selectedPeriodKey) ||
            visiblePeriods[0];
          if (!active) return null;
          return (
            <>
              <div className="font-semibold text-slate-900">
                {active.label}
                <span className="font-normal text-slate-500 ml-2">
                  ({active.transactionCount} transaksi)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-5 font-mono tabular-nums">
                <div>
                  <span className="font-sans text-slate-500 mr-1.5">Saldo Awal:</span>
                  <span className="font-semibold text-slate-700">
                    {formatIDR(active.openingBalance)}
                  </span>
                </div>
                <div>
                  <span className="font-sans text-slate-500 mr-1.5">Pemasukan:</span>
                  <span className="font-semibold text-emerald-700">
                    +{formatIDR(active.totalIncome)}
                  </span>
                </div>
                <div>
                  <span className="font-sans text-slate-500 mr-1.5">Pengeluaran:</span>
                  <span className="font-semibold text-red-700">
                    -{formatIDR(active.totalExpense)}
                  </span>
                </div>
                <div>
                  <span className="font-sans text-slate-500 mr-1.5">Saldo Akhir:</span>
                  <span className="font-bold text-slate-900">
                    {formatIDR(active.closingBalance)}
                  </span>
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </section>
  );
}
