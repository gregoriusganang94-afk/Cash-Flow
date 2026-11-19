import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Eye, Link2, Power, Trash2, X } from 'lucide-react';
import { BLUEPRINT_LIMITS, type ShareSnapshot } from '../types/cashflow';

interface ShareModalProps {
  isOpen: boolean;
  activeShare: ShareSnapshot | null;
  transactionCount: number;
  onClose: () => void;
  onCreateOrUpdateShare: (title?: string) => Promise<ShareSnapshot>;
  onToggleShareActive: (active: boolean) => Promise<void>;
  onDeleteShare: () => Promise<void>;
  onOpenPreview: (shareId: string) => void;
}

export function ShareModal({
  isOpen,
  activeShare,
  transactionCount,
  onClose,
  onCreateOrUpdateShare,
  onToggleShareActive,
  onDeleteShare,
  onOpenPreview,
}: ShareModalProps) {
  const [titleInput, setTitleInput] = useState(
    activeShare?.title || 'Laporan Cash Flow KasSiklus'
  );
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitleInput(activeShare?.title || 'Laporan Cash Flow KasSiklus');
      setCopied(false);
      setConfirmDelete(false);
      setStatusMsg(null);
      setErrorMsg(null);
    }
  }, [isOpen, activeShare?.title]);

  if (!isOpen) return null;

  const shareUrl = activeShare
    ? `${window.location.origin}/?share=${activeShare.id}`
    : '';

  const handleGenerateOrSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await onCreateOrUpdateShare(titleInput);
      setStatusMsg(
        activeShare
          ? 'Judul & isi link read-only berhasil diperbarui.'
          : 'Link read-only berhasil dibuat dan siap dibagikan.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membuat link berbagi.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setErrorMsg('Gagal menyalin otomatis. Silakan salin link dari kolom di atas.');
    }
  };

  const handleToggle = async () => {
    if (!activeShare) return;
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await onToggleShareActive(!activeShare.active);
      setStatusMsg(
        !activeShare.active
          ? 'Link read-only diaktifkan kembali.'
          : 'Link read-only dinonaktifkan sementara.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengubah status link.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await onDeleteShare();
      setConfirmDelete(false);
      setStatusMsg('Link read-only dihapus permanen.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menghapus link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Link2 className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <h2
              id="share-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Bagikan Link Read-Only
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            aria-label="Tutup jendela bagikan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Penerima link dapat melihat <strong>Ringkasan</strong>, <strong>Grafik Bulanan</strong>, dan{' '}
            <strong>Daftar Transaksi</strong> tanpa perlu login dan <strong>tidak bisa mengubah atau menghapus data</strong>. Data otomatis sinkron setiap kali Anda menambah atau mengubah transaksi.
          </p>

          <form onSubmit={handleGenerateOrSave} className="space-y-3">
            <div>
              <label
                htmlFor="share-title"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Judul Laporan untuk Penerima
              </label>
              <input
                id="share-title"
                type="text"
                maxLength={BLUEPRINT_LIMITS.MAX_SHARE_TITLE_LEN}
                required
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="Contoh: Laporan Kas Usaha November"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Mencakup {Math.min(transactionCount, BLUEPRINT_LIMITS.MAX_SHARE_TX_COUNT)} transaksi terbaru (tanpa email akun).
              </span>
              <button
                type="submit"
                disabled={busy}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {busy
                  ? 'Memproses...'
                  : activeShare
                    ? 'Simpan Judul & Sinkron'
                    : 'Buat Link Read-Only'}
              </button>
            </div>
          </form>

          {activeShare && (
            <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  Status:{' '}
                  <strong
                    className={
                      activeShare.active
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }
                  >
                    {activeShare.active ? 'Aktif (Bisa Dilihat)' : 'Nonaktif'}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenPreview(activeShare.id)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  <span>Pratinjau</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                  aria-label="Tautan read-only"
                  className="flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg select-all"
                />
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-2 text-xs font-semibold text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Tersalin' : 'Salin'}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleToggle()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <Power className="w-3.5 h-3.5" />
                  {activeShare.active ? 'Nonaktifkan Link' : 'Aktifkan Link'}
                </button>

                {confirmDelete ? (
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDelete()}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
                    >
                      Ya, Hapus Permanen
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Link
                  </button>
                )}
              </div>
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}
          {statusMsg && (
            <p className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2">
              {statusMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
