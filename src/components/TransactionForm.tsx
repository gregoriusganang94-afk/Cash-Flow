import React, { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Pencil, SlidersHorizontal, X } from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type CashFlowTransaction,
  type TransactionType,
  type UserSettings,
} from '../types/cashflow';
import type { TransactionInput } from '../hooks/useCashFlowStore';
import { formatIDR, getPeriodKeyForDate, getPeriodRange } from '../utils/cashflowPeriods';

interface TransactionFormProps {
  settings: UserSettings;
  editingTransaction: CashFlowTransaction | null;
  onCancelEdit: () => void;
  onSubmitTransaction: (input: TransactionInput, editingId?: string) => Promise<void>;
  onSaveCycleSettings: (next: {
    startPeriodKey: string;
    cutoffDay: number;
  }) => Promise<void>;
}

export function TransactionForm({
  settings,
  editingTransaction,
  onCancelEdit,
  onSubmitTransaction,
  onSaveCycleSettings,
}: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>('income');
  const [date, setDate] = useState('2026-11-25');
  const [amountInput, setAmountInput] = useState('');
  const [category, setCategory] = useState<string>(INCOME_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [startPeriodInput, setStartPeriodInput] = useState(settings.startPeriodKey);
  const [cutoffDayInput, setCutoffDayInput] = useState(String(settings.cutoffDay));
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  useEffect(() => {
    setStartPeriodInput(settings.startPeriodKey);
    setCutoffDayInput(String(settings.cutoffDay));
  }, [settings.startPeriodKey, settings.cutoffDay]);

  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
      setDate(editingTransaction.date);
      setAmountInput(String(editingTransaction.amount));
      const presets =
        editingTransaction.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      if ((presets as readonly string[]).includes(editingTransaction.category)) {
        setCategory(editingTransaction.category);
        setCustomCategory('');
      } else {
        setCategory('__custom__');
        setCustomCategory(editingTransaction.category);
      }
      setDescription(editingTransaction.description);
      setFormError(null);
      setFormSuccess(null);
    }
  }, [editingTransaction]);

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleTypeSwitch = (nextType: TransactionType) => {
    setType(nextType);
    const nextList = nextType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    setCategory(nextList[0]);
    setCustomCategory('');
  };

  const parsedAmount = Number(amountInput.replace(/[^\d.-]/g, ''));
  const computedPeriodKey = BLUEPRINT_LIMITS.DATE_PATTERN.test(date)
    ? getPeriodKeyForDate(date, settings.cutoffDay)
    : settings.startPeriodKey;
  const computedPeriodRange = getPeriodRange(computedPeriodKey, settings.cutoffDay);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const finalCategory = category === '__custom__' ? customCategory.trim() : category;
    if (!BLUEPRINT_LIMITS.DATE_PATTERN.test(date)) {
      setFormError('Pilih tanggal yang valid (YYYY-MM-DD).');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > BLUEPRINT_LIMITS.MAX_AMOUNT) {
      setFormError('Masukkan nominal lebih dari Rp 0.');
      return;
    }
    if (!finalCategory) {
      setFormError('Kategori wajib diisi.');
      return;
    }
    if (!description.trim()) {
      setFormError('Keterangan transaksi wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitTransaction(
        {
          type,
          amount: parsedAmount,
          category: finalCategory,
          description: description.trim(),
          date,
        },
        editingTransaction?.id
      );

      if (editingTransaction) {
        onCancelEdit();
        setFormSuccess('Transaksi berhasil diperbarui di Firestore.');
      } else {
        setAmountInput('');
        setDescription('');
        setFormSuccess(
          `${type === 'income' ? 'Pemasukan' : 'Pengeluaran'} dicatat ke periode ${computedPeriodRange.label}.`
        );
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan transaksi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMsg(null);
    const nextCutoff = Math.trunc(Number(cutoffDayInput));

    if (!BLUEPRINT_LIMITS.PERIOD_KEY_PATTERN.test(startPeriodInput)) {
      setSettingsMsg('Format periode awal harus YYYY-MM (contoh: 2026-11).');
      return;
    }
    if (nextCutoff < 1 || nextCutoff > 28) {
      setSettingsMsg('Tanggal cut-off siklus harus antara 1 dan 28.');
      return;
    }

    setSavingSettings(true);
    try {
      await onSaveCycleSettings({
        startPeriodKey: startPeriodInput,
        cutoffDay: nextCutoff,
      });
      setSettingsMsg('Pengaturan siklus periode tersimpan.');
    } catch (err) {
      setSettingsMsg(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <section
      id="input-transaksi"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {editingTransaction ? 'Ubah Transaksi' : 'Input Pemasukan & Pengeluaran'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Otomatis dikelompokkan ke siklus tanggal {settings.cutoffDay}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings((prev) => !prev)}
          className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Atur Siklus
        </button>
      </div>

      {showSettings && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Konfigurasi Siklus Periode
            </span>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer"
              aria-label="Tutup pengaturan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Periode Mulai (YYYY-MM)
              </label>
              <input
                type="month"
                value={startPeriodInput}
                onChange={(e) => setStartPeriodInput(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Tanggal Cut-Off (1–28)
              </label>
              <input
                type="number"
                min={1}
                max={28}
                value={cutoffDayInput}
                onChange={(e) => setCutoffDayInput(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {settingsMsg || `Cut-off saat ini: tanggal ${settings.cutoffDay}`}
            </span>
            <button
              type="submit"
              disabled={savingSettings}
              className="px-3.5 py-2 text-xs font-medium text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </div>
        </form>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => handleTypeSwitch('income')}
            className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              type === 'income'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Pemasukan
          </button>
          <button
            type="button"
            onClick={() => handleTypeSwitch('expense')}
            className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              type === 'expense'
                ? 'bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Pengeluaran
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="tx-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tanggal Transaksi
            </label>
            <input
              id="tx-date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
            />
          </div>

          <div>
            <label htmlFor="tx-amount" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nominal (Rp)
            </label>
            <input
              id="tx-amount"
              type="number"
              min="1"
              step="1"
              required
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="Contoh: 5000000"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/70 px-3 py-2 rounded-lg">
          <span>Periode: {computedPeriodRange.label}</span>
          <span className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
            {Number.isFinite(parsedAmount) && parsedAmount > 0 ? formatIDR(parsedAmount) : 'Rp 0'}
          </span>
        </div>

        <div>
          <label htmlFor="tx-category" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Kategori
          </label>
          <select
            id="tx-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
            <option value="__custom__">+ Kategori Khusus...</option>
          </select>
        </div>

        {category === '__custom__' && (
          <div>
            <label htmlFor="tx-custom-cat" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nama Kategori Khusus
            </label>
            <input
              id="tx-custom-cat"
              type="text"
              maxLength={BLUEPRINT_LIMITS.MAX_CATEGORY_LEN}
              required
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="Misal: Proyek Web / Pajak"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
            />
          </div>
        )}

        <div>
          <label htmlFor="tx-desc" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Keterangan
          </label>
          <input
            id="tx-desc"
            type="text"
            maxLength={BLUEPRINT_LIMITS.MAX_DESCRIPTION_LEN}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              type === 'income'
                ? 'Contoh: Gaji bulanan November'
                : 'Contoh: Bayar listrik & internet'
            }
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
          />
        </div>

        {formError && (
          <p className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
            {formError}
          </p>
        )}
        {formSuccess && (
          <p className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2 inline-flex items-center gap-1.5 w-full">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{formSuccess}</span>
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          {editingTransaction && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="min-h-[44px] px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {editingTransaction ? (
              <>
                <Pencil className="w-4 h-4" />
                {submitting ? 'Memperbarui...' : 'Perbarui Transaksi'}
              </>
            ) : (
              <>{submitting ? 'Menyimpan...' : 'Simpan Transaksi'}</>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
