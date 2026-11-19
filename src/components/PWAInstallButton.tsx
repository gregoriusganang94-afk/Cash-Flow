import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, isMobile, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        Instal Aplikasi
      </button>
    );
  }

  if (!isIOS && !isMobile) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Smartphone className="w-3.5 h-3.5" />
        {isIOS ? 'Instal di iPhone' : 'Pasang di HP'}
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-black/70 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="w-full sm:max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h3 id="pwa-guide-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {isIOS ? 'Instal KasSiklus di iPhone / iPad' : 'Instal KasSiklus di HP Android'}
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-2 -mr-2 -mt-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                aria-label="Tutup panduan instalasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal pl-5">
                <li>
                  Buka halaman aplikasi ini langsung di browser <strong>Safari</strong>.
                </li>
                <li>
                  Ketuk ikon <strong>Bagikan (Share)</strong> pada bilah menu bawah Safari.
                </li>
                <li>
                  Gulir ke bawah lalu pilih <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                </li>
              </ol>
            ) : (
              <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal pl-5">
                <li>
                  Pastikan aplikasi dibuka langsung di tab <strong>Google Chrome</strong> (bukan di dalam jendela pratinjau/iframe).
                </li>
                <li>
                  Ketuk menu titik tiga <strong>(⋮)</strong> di pojok kanan atas Chrome.
                </li>
                <li>
                  Pilih <strong>Instal aplikasi</strong> atau <strong>Tambahkan ke layar utama</strong>.
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full min-h-[44px] py-2.5 text-sm font-semibold text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
