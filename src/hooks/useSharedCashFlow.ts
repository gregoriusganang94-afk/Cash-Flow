import { useEffect, useState } from 'react';
import { doc, onSnapshot, type Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { CashFlowTransaction, ShareSnapshot } from '../types/cashflow';

function timestampToMs(val: unknown): number {
  if (
    val &&
    typeof val === 'object' &&
    'toMillis' in val &&
    typeof (val as Timestamp).toMillis === 'function'
  ) {
    return (val as Timestamp).toMillis();
  }
  return Date.now();
}

export interface SharedCashFlowState {
  loading: boolean;
  errorMessage: string | null;
  snapshot: ShareSnapshot | null;
  transactions: CashFlowTransaction[];
}

export function useSharedCashFlow(shareId: string | null): SharedCashFlowState {
  const [loading, setLoading] = useState(Boolean(shareId));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ShareSnapshot | null>(null);
  const [transactions, setTransactions] = useState<CashFlowTransaction[]>([]);

  useEffect(() => {
    if (!shareId) {
      setLoading(false);
      setSnapshot(null);
      setTransactions([]);
      setErrorMessage(null);
      return;
    }

    if (!/^[a-zA-Z0-9_-]{16,64}$/.test(shareId)) {
      setLoading(false);
      setSnapshot(null);
      setTransactions([]);
      setErrorMessage('Tautan berbagi tidak valid.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const shareRef = doc(db, 'shares', shareId);
    const unsub = onSnapshot(
      shareRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          setSnapshot(null);
          setTransactions([]);
          setErrorMessage('Tautan berbagi tidak ditemukan atau sudah dihapus oleh pemilik.');
          setLoading(false);
          return;
        }

        const data = docSnap.data();
        if (!data.active) {
          setSnapshot(null);
          setTransactions([]);
          setErrorMessage('Tautan berbagi ini sedang dinonaktifkan oleh pemilik.');
          setLoading(false);
          return;
        }

        const createdAtMs = timestampToMs(data.createdAt);
        const updatedAtMs = timestampToMs(data.updatedAt);

        const rawTxs = Array.isArray(data.transactions) ? data.transactions : [];
        const parsedTxs: CashFlowTransaction[] = rawTxs.map(
          (item: Record<string, unknown>, idx: number) => ({
            id: String(item.id || `shared-${idx}`),
            userId: 'shared-viewer',
            type: item.type === 'income' ? 'income' : 'expense',
            amount: typeof item.amount === 'number' ? item.amount : Number(item.amount) || 0,
            category: String(item.category || 'Lainnya'),
            description: String(item.description || ''),
            date: String(item.date || '2026-11-25'),
            periodKey: String(item.periodKey || '2026-11'),
            createdAtMs,
            updatedAtMs,
          })
        );

        parsedTxs.sort((a, b) => b.date.localeCompare(a.date));

        setSnapshot({
          id: docSnap.id,
          userId: String(data.userId || ''),
          title: String(data.title || 'Laporan Cash Flow KasSiklus'),
          active: Boolean(data.active),
          startPeriodKey: String(data.startPeriodKey || '2026-11'),
          cutoffDay: typeof data.cutoffDay === 'number' ? data.cutoffDay : 25,
          transactions: parsedTxs.map((t) => ({
            id: t.id,
            type: t.type,
            amount: t.amount,
            category: t.category,
            description: t.description,
            date: t.date,
            periodKey: t.periodKey,
          })),
          createdAtMs,
          updatedAtMs,
        });
        setTransactions(parsedTxs);
        setErrorMessage(null);
        setLoading(false);
      },
      () => {
        setSnapshot(null);
        setTransactions([]);
        setErrorMessage('Tautan berbagi tidak ditemukan, dinonaktifkan, atau aksesnya telah dicabut.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [shareId]);

  return { loading, errorMessage, snapshot, transactions };
}
