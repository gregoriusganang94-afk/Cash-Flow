import React, { useCallback, useEffect, useState } from 'react';
import {
  Download,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  Link2,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import type {
  CashFlowTransaction,
  GithubInspectResponse,
  GithubStatusResponse,
  PeriodSummary,
  UserSettings,
} from '../types/cashflow';
import type { TransactionInput } from '../hooks/useCashFlowStore';

interface GithubSyncPanelProps {
  settings: UserSettings;
  transactions: CashFlowTransaction[];
  periods: PeriodSummary[];
  onSaveGithubSettings: (next: {
    githubRepo: string;
    githubBranch: string;
    githubFilePath: string;
  }) => Promise<void>;
  onImportTransactions: (
    items: TransactionInput[],
    baseOpeningBalance?: number | null
  ) => Promise<void>;
}

export function GithubSyncPanel({
  settings,
  transactions,
  periods,
  onSaveGithubSettings,
  onImportTransactions,
}: GithubSyncPanelProps) {
  const [repoInput, setRepoInput] = useState(settings.githubRepo);
  const [branchInput, setBranchInput] = useState(settings.githubBranch || 'main');
  const [filePathInput, setFilePathInput] = useState(
    settings.githubFilePath || 'cashflow/ledger.json'
  );

  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [ghStatus, setGhStatus] = useState<GithubStatusResponse>({
    authenticated: false,
    user: null,
    repos: [],
  });
  const [inspectData, setInspectData] = useState<GithubInspectResponse | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  useEffect(() => {
    setRepoInput(settings.githubRepo);
    setBranchInput(settings.githubBranch || 'main');
    setFilePathInput(settings.githubFilePath || 'cashflow/ledger.json');
  }, [settings.githubRepo, settings.githubBranch, settings.githubFilePath]);

  const fetchGithubStatus = useCallback(async () => {
    try {
      const [cfgRes, statusRes] = await Promise.all([
        fetch('/api/github/config'),
        fetch('/api/github/status'),
      ]);
      if (cfgRes.ok) {
        const cfg = (await cfgRes.json()) as {
          oauthConfigured: boolean;
          callbackUrl: string;
        };
        setOauthConfigured(cfg.oauthConfigured);
        setCallbackUrl(cfg.callbackUrl);
      }
      if (statusRes.ok) {
        const st = (await statusRes.json()) as GithubStatusResponse;
        setGhStatus(st);
      }
    } catch {
      // Ignore network hiccup during initial check
    }
  }, []);

  useEffect(() => {
    void fetchGithubStatus();
  }, [fetchGithubStatus]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        void fetchGithubStatus();
        setFeedback({ type: 'ok', text: 'Akun GitHub berhasil terhubung.' });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchGithubStatus]);

  const runInspect = useCallback(
    async (repo: string, branch: string, filePath: string, saveToFirestore: boolean) => {
      const cleanRepo = repo.trim();
      if (!cleanRepo) {
        setFeedback({ type: 'err', text: 'Masukkan nama repositori (format: owner/repo).' });
        return;
      }
      setBusyAction('inspect');
      setFeedback(null);
      try {
        if (saveToFirestore) {
          await onSaveGithubSettings({
            githubRepo: cleanRepo,
            githubBranch: branch.trim() || 'main',
            githubFilePath: filePath.trim() || 'cashflow/ledger.json',
          });
        }

        const res = await fetch('/api/github/inspect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repo: cleanRepo,
            branch: branch.trim() || 'main',
            filePath: filePath.trim() || 'cashflow/ledger.json',
          }),
        });
        const data = (await res.json()) as GithubInspectResponse & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || 'Gagal memeriksa repositori GitHub.');
        }
        setInspectData(data);
        setFeedback({
          type: 'ok',
          text: `Terhubung ke ${data.repository.fullName} (branch ${data.branch}).`,
        });
      } catch (err) {
        setFeedback({
          type: 'err',
          text: err instanceof Error ? err.message : 'Gagal menghubungkan repositori.',
        });
      } finally {
        setBusyAction(null);
      }
    },
    [onSaveGithubSettings]
  );

  // Auto-inspect saved repo once when settings load
  useEffect(() => {
    if (settings.githubRepo && !inspectData) {
      void runInspect(
        settings.githubRepo,
        settings.githubBranch || 'main',
        settings.githubFilePath || 'cashflow/ledger.json',
        false
      );
    }
  }, [settings.githubRepo, settings.githubBranch, settings.githubFilePath, inspectData, runInspect]);

  const handleConnectOAuth = async () => {
    setFeedback(null);
    try {
      const res = await fetch('/api/github/auth/url');
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Gagal membuat URL OAuth GitHub.');
      }
      const popup = window.open(data.url, 'github_oauth_popup', 'width=620,height=720');
      if (!popup) {
        setFeedback({
          type: 'err',
          text: 'Popup diblokir browser. Izinkan popup untuk menghubungkan GitHub.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memulai OAuth GitHub.',
      });
    }
  };

  const handleDisconnectOAuth = async () => {
    await fetch('/api/github/logout', { method: 'POST' });
    setGhStatus({ authenticated: false, user: null, repos: [] });
    setFeedback({ type: 'ok', text: 'Sesi OAuth GitHub diputus.' });
  };

  const handlePushSnapshot = async () => {
    const cleanRepo = repoInput.trim();
    if (!cleanRepo) {
      setFeedback({ type: 'err', text: 'Tentukan repositori GitHub tujuan terlebih dahulu.' });
      return;
    }
    setBusyAction('push');
    setFeedback(null);

    try {
      const payload = {
        app: 'KasSiklus',
        updatedAt: new Date().toISOString(),
        cutoffDay: settings.cutoffDay,
        startPeriodKey: settings.startPeriodKey,
        baseOpeningBalance: settings.baseOpeningBalance,
        periodSummaries: periods,
        transactions: transactions.map((t) => ({
          id: t.id,
          date: t.date,
          periodKey: t.periodKey,
          type: t.type,
          category: t.category,
          description: t.description,
          amount: t.amount,
        })),
      };

      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: cleanRepo,
          branch: branchInput.trim() || 'main',
          filePath: filePathInput.trim() || 'cashflow/ledger.json',
          payload,
        }),
      });

      const data = (await res.json()) as {
        commitSha?: string;
        commitUrl?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Gagal melakukan push ke GitHub.');
      }
      setFeedback({
        type: 'ok',
        text: `Snapshot berhasil di-commit ke ${cleanRepo} (${data.commitSha || 'ok'}).`,
      });
      await runInspect(cleanRepo, branchInput, filePathInput, false);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal sinkronisasi ke GitHub.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleImportFromGithub = async () => {
    const cleanRepo = repoInput.trim();
    if (!cleanRepo) {
      setFeedback({ type: 'err', text: 'Masukkan nama repositori sumber.' });
      return;
    }
    setBusyAction('import');
    setFeedback(null);
    try {
      const res = await fetch('/api/github/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: cleanRepo,
          branch: branchInput.trim() || 'main',
          filePath: filePathInput.trim() || 'cashflow/ledger.json',
        }),
      });
      const data = (await res.json()) as {
        baseOpeningBalance: number | null;
        transactions: TransactionInput[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengimpor file dari GitHub.');
      }
      if (data.transactions.length === 0) {
        setFeedback({
          type: 'err',
          text: 'File ditemukan namun tidak berisi transaksi cash flow yang valid.',
        });
        return;
      }
      await onImportTransactions(data.transactions, data.baseOpeningBalance);
      setFeedback({
        type: 'ok',
        text: `${data.transactions.length} transaksi dari GitHub berhasil diimpor ke Firestore.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengimpor data GitHub.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadJson = () => {
    const payload = {
      app: 'KasSiklus',
      exportedAt: new Date().toISOString(),
      cutoffDay: settings.cutoffDay,
      startPeriodKey: settings.startPeriodKey,
      baseOpeningBalance: settings.baseOpeningBalance,
      periodSummaries: periods,
      transactions: transactions.map((t) => ({
        date: t.date,
        periodKey: t.periodKey,
        type: t.type,
        category: t.category,
        description: t.description,
        amount: t.amount,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashflow-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    const header = ['Tanggal', 'Periode', 'Jenis', 'Kategori', 'Keterangan', 'Nominal'];
    const rows = transactions.map((t) => [
      t.date,
      t.periodKey,
      t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      `"${t.category.replace(/"/g, '""')}"`,
      `"${t.description.replace(/"/g, '""')}"`,
      String(t.amount),
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashflow-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      id="github-sync"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Integrasi Repositori GitHub
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Hubungkan repositori GitHub untuk menyimpan cadangan ledger JSON, memantau riwayat commit, atau mengimpor transaksi ke Firestore
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ghStatus.authenticated && ghStatus.user ? (
            <div className="inline-flex items-center gap-3 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <span className="font-medium text-slate-900">
                GitHub: @{ghStatus.user.login}
              </span>
              <button
                type="button"
                onClick={() => void handleDisconnectOAuth()}
                className="text-red-600 hover:text-red-700 font-medium cursor-pointer"
              >
                Putuskan
              </button>
            </div>
          ) : oauthConfigured ? (
            <button
              type="button"
              onClick={() => void handleConnectOAuth()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
              Hubungkan Akun GitHub (OAuth)
            </button>
          ) : (
            <span className="text-xs text-slate-500">
              Mode Repo Publik · Tambah OAuth untuk push langsung
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Repository Configuration & Actions */}
        <div className="lg:col-span-6 space-y-4">
          {ghStatus.authenticated && ghStatus.repos.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Pilih dari Repositori Akun Anda
              </label>
              <select
                value={repoInput}
                onChange={(e) => {
                  const selected = ghStatus.repos.find((r) => r.fullName === e.target.value);
                  setRepoInput(e.target.value);
                  if (selected) {
                    setBranchInput(selected.defaultBranch);
                  }
                }}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">-- Pilih repositori --</option>
                {ghStatus.repos.map((r) => (
                  <option key={r.fullName} value={r.fullName}>
                    {r.fullName} ({r.isPrivate ? 'Privat' : 'Publik'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Repositori (owner/repo)
              </label>
              <input
                type="text"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="Contoh: username/cashflow-ledger"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Branch
              </label>
              <input
                type="text"
                value={branchInput}
                onChange={(e) => setBranchInput(e.target.value)}
                placeholder="main"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Path File Snapshot JSON
            </label>
            <input
              type="text"
              value={filePathInput}
              onChange={(e) => setFilePathInput(e.target.value)}
              placeholder="cashflow/ledger.json"
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void runInspect(repoInput, branchInput, filePathInput, true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busyAction === 'inspect' ? 'animate-spin' : ''}`} />
              Simpan & Cek Repo
            </button>

            <button
              type="button"
              disabled={busyAction !== null || !repoInput.trim()}
              onClick={() => void handleImportFromGithub()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Impor dari GitHub
            </button>

            <button
              type="button"
              disabled={busyAction !== null || !repoInput.trim() || !ghStatus.authenticated}
              onClick={() => void handlePushSnapshot()}
              title={
                ghStatus.authenticated
                  ? 'Commit ledger JSON ke repositori GitHub'
                  : 'Hubungkan akun GitHub OAuth untuk commit ke repositori'
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-45 cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Commit ke GitHub
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1 hover:text-slate-900 underline underline-offset-4 cursor-pointer"
            >
              Unduh Snapshot JSON
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1 hover:text-slate-900 underline underline-offset-4 cursor-pointer"
            >
              Unduh Ekspor CSV
            </button>
          </div>

          {feedback && (
            <p
              className={`text-xs rounded-lg px-3 py-2 border ${
                feedback.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {feedback.text}
            </p>
          )}
        </div>

        {/* Right: Repository Telemetry & Recent Commits */}
        <div className="lg:col-span-6 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
          {inspectData ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <a
                    href={inspectData.repository.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:underline"
                  >
                    <span>{inspectData.repository.fullName}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {inspectData.repository.description || 'Repositori cash flow terhubung'}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 text-xs font-mono text-slate-600">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>{inspectData.branch}</span>
                </div>
              </div>

              <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3 border-y border-slate-200 py-2">
                <span>
                  Status File <code className="font-mono">{inspectData.filePath}</code>:{' '}
                  <strong className="text-slate-900">
                    {inspectData.file.exists ? 'Tersedia di repo' : 'Belum ada (siap dibuat saat commit)'}
                  </strong>
                </span>
                {inspectData.file.htmlUrl && (
                  <a
                    href={inspectData.file.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-800 underline underline-offset-2"
                  >
                    Buka file
                  </a>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">
                  Riwayat Commit Terbaru
                </div>
                {inspectData.recentCommits.length === 0 ? (
                  <p className="text-xs text-slate-500">Belum ada riwayat commit pada branch ini.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {inspectData.recentCommits.map((c) => (
                      <li
                        key={c.sha}
                        className="flex items-center justify-between gap-3 text-xs text-slate-700"
                      >
                        <a
                          href={c.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 truncate hover:underline"
                        >
                          <GitCommitHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono text-slate-500 shrink-0">{c.sha}</span>
                          <span className="truncate">{c.message}</span>
                        </a>
                        <span className="text-slate-400 font-mono shrink-0">
                          {c.date ? c.date.slice(0, 10) : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col justify-center space-y-2 text-xs text-slate-600 py-4">
              <p className="font-semibold text-slate-800">
                Belum ada repositori GitHub yang diperiksa
              </p>
              <p className="leading-relaxed">
                Masukkan nama repositori publik atau pribadi Anda (misal{' '}
                <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  username/cashflow-ledger
                </code>
                ) lalu klik <strong>Simpan & Cek Repo</strong>.
              </p>
              {!oauthConfigured && callbackUrl && (
                <p className="text-slate-500 leading-relaxed pt-1">
                  Untuk commit langsung dari aplikasi ke repo privat/publik, tambahkan{' '}
                  <code className="font-mono">GITHUB_CLIENT_ID</code> dan{' '}
                  <code className="font-mono">GITHUB_CLIENT_SECRET</code> di Secrets dengan Callback URL:{' '}
                  <code className="font-mono break-all text-slate-700">{callbackUrl}</code>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
