import React, { useMemo, useState } from 'react';
import { Pencil, Search, Trash2 } from 'lucide-react';
import type { CashFlowTransaction, PeriodSummary } from '../types/cashflow';
import { formatDateID, formatIDR, getPeriodKeyForDate } from '../utils/cashflowPeriods';

interface TransactionLedgerProps {
  transactions: CashFlowTransaction[];
  periods: PeriodSummary[];
  cutoffDay: number;
  selectedPeriodKey: string | null;
  onSelectPeriod: (periodKey: string | null) => void;
  onEditTransaction: (tx: CashFlowTransaction) => void;
  onDeleteTransaction: (transactionId: string) => Promise<void>;
  onGoToInput?: () => void;
}

export function TransactionLedger({
  transactions,
  periods,
  cutoffDay,
  selectedPeriodKey,
  onSelectPeriod,
  onEditTransaction,
  onDeleteTransaction,
  onGoToInput,
}: TransactionLedgerProps) {
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const periodLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of periods) {
      map.set(p.periodKey, p.label);
    }
    return map;
  }, [periods]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      const txPeriod = getPeriodKeyForDate(tx.date, cutoffDay);
      if (selectedPeriodKey && txPeriod !== selectedPeriodKey) return false;
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (
        q &&
        !tx.description.toLowerCase().includes(q) &&
        !tx.category.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [transactions, cutoffDay, selectedPeriodKey, typeFilter, searchQuery]);

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteTransaction(id);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section
      id="daftar-transaksi"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
    >
      <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Catatan Transaksi Firestore
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Menampilkan {filtered.length} dari {transactions.length} transaksi tersimpan
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari keterangan atau kategori..."
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 w-52"
            />
          </div>

          <select
            value={selectedPeriodKey || ''}
            onChange={(e) => onSelectPeriod(e.target.value || null)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
            aria-label="Filter periode"
          >
            <option value="">Semua Periode</option>
            {periods.map((p) => (
              <option key={p.periodKey} value={p.periodKey}>
                {p.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['all', 'income', 'expense'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  typeFilter === t
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t === 'all' ? 'Semua' : t === 'income' ? 'Pemasukan' : 'Pengeluaran'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-12 text-center space-y-3">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            Belum ada transaksi untuk filter ini
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tambahkan pemasukan atau pengeluaran baru pada menu Input untuk mulai memantau arus kas Anda.
          </p>
          {onGoToInput && (
            <button
              type="button"
              onClick={onGoToInput}
              className="inline-flex items-center justify-center min-h-[40px] px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors cursor-pointer"
            >
              Buka Form Input
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-2.5 px-4 whitespace-nowrap">Tanggal</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Periode</th>
                <th className="py-2.5 px-4">Keterangan &amp; Kategori</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Jenis</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Nominal</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filtered.map((tx) => {
                const txPeriodKey = getPeriodKeyForDate(tx.date, cutoffDay);
                const periodLabel = periodLabelMap.get(txPeriodKey) || txPeriodKey;
                const isConfirming = confirmDeleteId === tx.id;

                return (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatDateID(tx.date)}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {periodLabel}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{tx.description}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{tx.category}</div>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold ${
                          tx.type === 'income'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                      </span>
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                        tx.type === 'income'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatIDR(tx.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {isConfirming ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={deletingId === tx.id}
                            onClick={() => void handleConfirmDelete(tx.id)}
                            className="px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded cursor-pointer"
                          >
                            {deletingId === tx.id ? '...' : 'Hapus'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditTransaction(tx)}
                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            aria-label={`Ubah ${tx.description}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(tx.id)}
                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                            aria-label={`Hapus ${tx.description}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
