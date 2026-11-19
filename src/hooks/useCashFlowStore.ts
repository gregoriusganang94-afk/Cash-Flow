import { useCallback, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  BLUEPRINT_LIMITS,
  type CashFlowTransaction,
  type ShareSnapshot,
  type ShareTransactionItem,
  type TransactionType,
  type UserSettings,
} from '../types/cashflow';
import { getPeriodKeyForDate } from '../utils/cashflowPeriods';

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
}

const DEFAULT_SETTINGS = (uid: string): UserSettings => ({
  userId: uid,
  startPeriodKey: '2026-11',
  cutoffDay: 25,
});

function timestampToMs(val: unknown): number {
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as Timestamp).toMillis === 'function') {
    return (val as Timestamp).toMillis();
  }
  return Date.now();
}

function sanitizeTransactionPayload(
  input: TransactionInput,
  cutoffDay: number
): Omit<TransactionInput, 'category' | 'description'> & {
  category: string;
  description: string;
  periodKey: string;
} {
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > BLUEPRINT_LIMITS.MAX_AMOUNT) {
    throw new Error('Nominal transaksi harus lebih dari 0 dan valid.');
  }

  const category = input.category.trim().slice(0, BLUEPRINT_LIMITS.MAX_CATEGORY_LEN);
  if (!category) {
    throw new Error('Kategori transaksi wajib diisi.');
  }

  const description = input.description.trim().slice(0, BLUEPRINT_LIMITS.MAX_DESCRIPTION_LEN);
  if (!description) {
    throw new Error('Keterangan transaksi wajib diisi.');
  }

  const date = input.date.trim();
  if (!BLUEPRINT_LIMITS.DATE_PATTERN.test(date)) {
    throw new Error('Format tanggal harus YYYY-MM-DD.');
  }

  const periodKey = getPeriodKeyForDate(date, cutoffDay);
  if (!BLUEPRINT_LIMITS.PERIOD_KEY_PATTERN.test(periodKey)) {
    throw new Error('Periode transaksi tidak valid.');
  }

  return {
    type: input.type === 'income' ? 'income' : 'expense',
    amount,
    category,
    description,
    date,
    periodKey,
  };
}

const SHARE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

function generateShareToken(length = 24): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SHARE_ALPHABET[bytes[i] % SHARE_ALPHABET.length];
  }
  return out;
}

function toShareTransactions(items: CashFlowTransaction[]): ShareTransactionItem[] {
  return items.slice(0, BLUEPRINT_LIMITS.MAX_SHARE_TX_COUNT).map((tx) => ({
    id: tx.id,
    type: tx.type === 'income' ? 'income' : 'expense',
    amount: Math.round(Number(tx.amount) * 100) / 100,
    category: tx.category.trim().slice(0, BLUEPRINT_LIMITS.MAX_CATEGORY_LEN) || 'Lainnya',
    description: tx.description.trim().slice(0, BLUEPRINT_LIMITS.MAX_DESCRIPTION_LEN) || '-',
    date: tx.date,
    periodKey: tx.periodKey,
  }));
}

function buildShareSignature(
  title: string,
  startPeriodKey: string,
  cutoffDay: number,
  txs: ShareTransactionItem[]
): string {
  return JSON.stringify({
    title,
    startPeriodKey,
    cutoffDay,
    txs: txs.map((t) => [t.id, t.type, t.amount, t.category, t.description, t.date, t.periodKey]),
  });
}

export function useCashFlowStore() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [transactions, setTransactions] = useState<CashFlowTransaction[]>([]);
  const [activeShare, setActiveShare] = useState<ShareSnapshot | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [firestoreError, setFirestoreError] = useState<Error | null>(null);
  const lastShareSyncSigRef = useRef<string>('');

  if (firestoreError) {
    throw firestoreError;
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) {
        setSettings(null);
        setTransactions([]);
        setActiveShare(null);
        setDataLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    const uid = user.uid;
    const userDocRef = doc(db, 'users', uid);
    let cancelled = false;
    let unsubSettings: (() => void) | null = null;
    let unsubTransactions: (() => void) | null = null;
    let unsubShare: (() => void) | null = null;

    setDataLoading(true);

    async function bootstrapAndSubscribe() {
      try {
        const snap = await getDoc(userDocRef);
        if (!snap.exists()) {
          const defaults = DEFAULT_SETTINGS(uid);
          await setDoc(userDocRef, {
            ...defaults,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const existingData = snap.data();
          const hasLegacyFields =
            'baseOpeningBalance' in existingData ||
            'githubRepo' in existingData ||
            'githubBranch' in existingData ||
            'githubFilePath' in existingData;
          if (hasLegacyFields) {
            await updateDoc(userDocRef, {
              baseOpeningBalance: deleteField(),
              githubRepo: deleteField(),
              githubBranch: deleteField(),
              githubFilePath: deleteField(),
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          try {
            handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
          } catch (wrapped) {
            setFirestoreError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
            return;
          }
        }
      }

      if (cancelled) return;

      unsubSettings = onSnapshot(
        userDocRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const d = docSnap.data();
            setSettings({
              userId: uid,
              startPeriodKey: typeof d.startPeriodKey === 'string' ? d.startPeriodKey : '2026-11',
              cutoffDay: typeof d.cutoffDay === 'number' ? d.cutoffDay : 25,
            });
          } else {
            setSettings(DEFAULT_SETTINGS(uid));
          }
        },
        (err) => {
          try {
            handleFirestoreError(err, OperationType.GET, `users/${uid}`);
          } catch (wrapped) {
            setFirestoreError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
          }
        }
      );

      const txPath = `users/${uid}/transactions`;
      const txQuery = query(collection(db, 'users', uid, 'transactions'), where('userId', '==', uid));

      unsubTransactions = onSnapshot(
        txQuery,
        (querySnap) => {
          const items: CashFlowTransaction[] = querySnap.docs.map((docItem) => {
            const data = docItem.data();
            return {
              id: docItem.id,
              userId: String(data.userId || uid),
              type: data.type === 'income' ? 'income' : 'expense',
              amount: typeof data.amount === 'number' ? data.amount : Number(data.amount) || 0,
              category: String(data.category || 'Lainnya'),
              description: String(data.description || ''),
              date: String(data.date || '2026-11-25'),
              periodKey: String(data.periodKey || '2026-11'),
              createdAtMs: timestampToMs(data.createdAt),
              updatedAtMs: timestampToMs(data.updatedAt),
            };
          });

          items.sort((a, b) => {
            const dateCmp = b.date.localeCompare(a.date);
            if (dateCmp !== 0) return dateCmp;
            return b.createdAtMs - a.createdAtMs;
          });

          setTransactions(items);
          setDataLoading(false);
        },
        (err) => {
          try {
            handleFirestoreError(err, OperationType.LIST, txPath);
          } catch (wrapped) {
            setFirestoreError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
          }
        }
      );

      const sharesQuery = query(collection(db, 'shares'), where('userId', '==', uid));
      unsubShare = onSnapshot(
        sharesQuery,
        (shareSnap) => {
          if (shareSnap.empty) {
            setActiveShare(null);
            lastShareSyncSigRef.current = '';
            return;
          }
          const shareDoc = shareSnap.docs[0];
          const data = shareDoc.data();
          const shareTxs: ShareTransactionItem[] = Array.isArray(data.transactions)
            ? data.transactions.map((t: Record<string, unknown>) => ({
                id: String(t.id || ''),
                type: t.type === 'income' ? 'income' : 'expense',
                amount: typeof t.amount === 'number' ? t.amount : Number(t.amount) || 0,
                category: String(t.category || 'Lainnya'),
                description: String(t.description || ''),
                date: String(t.date || '2026-11-25'),
                periodKey: String(t.periodKey || '2026-11'),
              }))
            : [];
          const snapshot: ShareSnapshot = {
            id: shareDoc.id,
            userId: String(data.userId || uid),
            title: String(data.title || 'Laporan Cash Flow KasSiklus'),
            active: Boolean(data.active),
            startPeriodKey: String(data.startPeriodKey || '2026-11'),
            cutoffDay: typeof data.cutoffDay === 'number' ? data.cutoffDay : 25,
            transactions: shareTxs,
            createdAtMs: timestampToMs(data.createdAt),
            updatedAtMs: timestampToMs(data.updatedAt),
          };
          lastShareSyncSigRef.current = buildShareSignature(
            snapshot.title,
            snapshot.startPeriodKey,
            snapshot.cutoffDay,
            snapshot.transactions
          );
          setActiveShare(snapshot);
        },
        (err) => {
          try {
            handleFirestoreError(err, OperationType.LIST, 'shares');
          } catch (wrapped) {
            setFirestoreError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
          }
        }
      );
    }

    void bootstrapAndSubscribe();

    return () => {
      cancelled = true;
      unsubSettings?.();
      unsubTransactions?.();
      unsubShare?.();
    };
  }, [authReady, user]);

  // Keep an active read-only share snapshot synchronized automatically whenever transactions/settings change
  useEffect(() => {
    if (!user || !settings || !activeShare || !activeShare.active || dataLoading) return;

    const shareTxs = toShareTransactions(transactions);
    const nextSig = buildShareSignature(
      activeShare.title,
      settings.startPeriodKey,
      settings.cutoffDay,
      shareTxs
    );

    if (nextSig === lastShareSyncSigRef.current) return;
    lastShareSyncSigRef.current = nextSig;

    const shareRef = doc(db, 'shares', activeShare.id);
    updateDoc(shareRef, {
      title: activeShare.title,
      startPeriodKey: settings.startPeriodKey,
      cutoffDay: settings.cutoffDay,
      transactions: shareTxs,
      updatedAt: serverTimestamp(),
    }).catch((err) => {
      handleFirestoreError(err, OperationType.UPDATE, `shares/${activeShare.id}`);
    });
  }, [user, settings, transactions, activeShare, dataLoading]);

  const signInWithGoogle = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk dengan Google.';
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  const addTransaction = useCallback(
    async (input: TransactionInput) => {
      if (!user) throw new Error('Silakan masuk terlebih dahulu.');
      const cutoffDay = settings?.cutoffDay ?? 25;
      const sanitized = sanitizeTransactionPayload(input, cutoffDay);
      const txCol = collection(db, 'users', user.uid, 'transactions');
      const newDocRef = doc(txCol);
      const path = `users/${user.uid}/transactions/${newDocRef.id}`;

      try {
        await setDoc(newDocRef, {
          userId: user.uid,
          ...sanitized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [user, settings?.cutoffDay]
  );

  const updateTransaction = useCallback(
    async (transactionId: string, input: TransactionInput) => {
      if (!user) throw new Error('Silakan masuk terlebih dahulu.');
      const cutoffDay = settings?.cutoffDay ?? 25;
      const sanitized = sanitizeTransactionPayload(input, cutoffDay);
      const path = `users/${user.uid}/transactions/${transactionId}`;
      const txRef = doc(db, 'users', user.uid, 'transactions', transactionId);

      try {
        await updateDoc(txRef, {
          ...sanitized,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user, settings?.cutoffDay]
  );

  const deleteTransaction = useCallback(
    async (transactionId: string) => {
      if (!user) throw new Error('Silakan masuk terlebih dahulu.');
      const path = `users/${user.uid}/transactions/${transactionId}`;
      const txRef = doc(db, 'users', user.uid, 'transactions', transactionId);

      try {
        await deleteDoc(txRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user]
  );

  const updateCycleSettings = useCallback(
    async (next: { startPeriodKey: string; cutoffDay: number }) => {
      if (!user) throw new Error('Silakan masuk terlebih dahulu.');
      if (!BLUEPRINT_LIMITS.PERIOD_KEY_PATTERN.test(next.startPeriodKey)) {
        throw new Error('Format periode mulai harus YYYY-MM.');
      }
      const cutoffDay = Math.trunc(Number(next.cutoffDay));
      if (cutoffDay < BLUEPRINT_LIMITS.MIN_CUTOFF_DAY || cutoffDay > BLUEPRINT_LIMITS.MAX_CUTOFF_DAY) {
        throw new Error('Tanggal cut-off siklus harus antara 1 dan 28.');
      }

      const path = `users/${user.uid}`;
      const userRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userRef, {
          startPeriodKey: next.startPeriodKey,
          cutoffDay,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  const createOrUpdateShareLink = useCallback(
    async (customTitle?: string): Promise<ShareSnapshot> => {
      if (!user) throw new Error('Silakan masuk terlebih dahulu.');
      const effectiveSettings = settings || DEFAULT_SETTINGS(user.uid);
      const cleanTitle =
        (customTitle ?? activeShare?.title ?? 'Laporan Cash Flow KasSiklus')
          .trim()
          .slice(0, BLUEPRINT_LIMITS.MAX_SHARE_TITLE_LEN) || 'Laporan Cash Flow KasSiklus';
      const shareTxs = toShareTransactions(transactions);

      if (activeShare) {
        const shareRef = doc(db, 'shares', activeShare.id);
        try {
          lastShareSyncSigRef.current = buildShareSignature(
            cleanTitle,
            effectiveSettings.startPeriodKey,
            effectiveSettings.cutoffDay,
            shareTxs
          );
          await updateDoc(shareRef, {
            title: cleanTitle,
            startPeriodKey: effectiveSettings.startPeriodKey,
            cutoffDay: effectiveSettings.cutoffDay,
            transactions: shareTxs,
            updatedAt: serverTimestamp(),
          });
          if (!activeShare.active) {
            await updateDoc(shareRef, {
              active: true,
              updatedAt: serverTimestamp(),
            });
          }
          return {
            ...activeShare,
            title: cleanTitle,
            active: true,
            startPeriodKey: effectiveSettings.startPeriodKey,
            cutoffDay: effectiveSettings.cutoffDay,
            transactions: shareTxs,
            updatedAtMs: Date.now(),
          };
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `shares/${activeShare.id}`);
        }
      }

      const shareId = generateShareToken(24);
      const shareRef = doc(db, 'shares', shareId);
      try {
        lastShareSyncSigRef.current = buildShareSignature(
          cleanTitle,
          effectiveSettings.startPeriodKey,
          effectiveSettings.cutoffDay,
          shareTxs
        );
        await setDoc(shareRef, {
          userId: user.uid,
          title: cleanTitle,
          active: true,
          startPeriodKey: effectiveSettings.startPeriodKey,
          cutoffDay: effectiveSettings.cutoffDay,
          transactions: shareTxs,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return {
          id: shareId,
          userId: user.uid,
          title: cleanTitle,
          active: true,
          startPeriodKey: effectiveSettings.startPeriodKey,
          cutoffDay: effectiveSettings.cutoffDay,
          transactions: shareTxs,
          createdAtMs: Date.now(),
          updatedAtMs: Date.now(),
        };
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `shares/${shareId}`);
      }
    },
    [user, settings, transactions, activeShare]
  );

  const toggleShareActive = useCallback(
    async (nextActive: boolean) => {
      if (!user || !activeShare) return;
      const shareRef = doc(db, 'shares', activeShare.id);
      try {
        await updateDoc(shareRef, {
          active: nextActive,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `shares/${activeShare.id}`);
      }
    },
    [user, activeShare]
  );

  const deleteShareLink = useCallback(async () => {
    if (!user || !activeShare) return;
    const shareRef = doc(db, 'shares', activeShare.id);
    try {
      await deleteDoc(shareRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `shares/${activeShare.id}`);
    }
  }, [user, activeShare]);

  return {
    user,
    authReady,
    authLoading,
    authError,
    settings,
    transactions,
    activeShare,
    dataLoading,
    signInWithGoogle,
    signOutUser,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    updateCycleSettings,
    createOrUpdateShareLink,
    toggleShareActive,
    deleteShareLink,
  };
}
