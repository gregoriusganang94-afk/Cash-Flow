import { useCallback, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
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
  baseOpeningBalance: 0,
  startPeriodKey: '2026-11',
  cutoffDay: 25,
  githubRepo: '',
  githubBranch: 'main',
  githubFilePath: 'cashflow/ledger.json',
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

export function useCashFlowStore() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [transactions, setTransactions] = useState<CashFlowTransaction[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [firestoreError, setFirestoreError] = useState<Error | null>(null);

  // Surface Firestore errors inside React render so ErrorBoundary catches permission/connection failures cleanly
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
              baseOpeningBalance: typeof d.baseOpeningBalance === 'number' ? d.baseOpeningBalance : 0,
              startPeriodKey: typeof d.startPeriodKey === 'string' ? d.startPeriodKey : '2026-11',
              cutoffDay: typeof d.cutoffDay === 'number' ? d.cutoffDay : 25,
              githubRepo: typeof d.githubRepo === 'string' ? d.githubRepo : '',
              githubBranch: typeof d.githubBranch === 'string' ? d.githubBranch : 'main',
              githubFilePath:
                typeof d.githubFilePath === 'string' ? d.githubFilePath : 'cashflow/ledger.json',
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
    }

    void bootstrapAndSubscribe();

    return () => {
      cancelled = true;
      unsubSettings?.();
      unsubTransactions?.();
    };
  }, [authReady, user]);

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

  const updateBalanceSettings = useCallback(
    async (next: { baseOpeningBalance: number; startPeriodKey: string; cutoffDay: number }) => {
      if (!user) throw new Error('Silakan masuk terlebih dahulu.');
      const baseOpeningBalance = Math.round(Number(next.baseOpeningBalance));
      if (!Number.isFinite(baseOpeningBalance) || Math.abs(baseOpeningBalance) > BLUEPRINT_LIMITS.MAX_AMOUNT) {
        throw new Error('Nominal saldo awal dasar tidak valid.');
      }
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
          baseOpeningBalance,
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

  const updateGithubSettings = useCallback(
    async (next: { githubRepo: string; githubBranch: string; githubFilePath: string }) => {
      if (!user) throw new Error('Silakan masuk terlebih dahulu.');
      const githubRepo = next.githubRepo.trim().slice(0, BLUEPRINT_LIMITS.MAX_REPO_LEN);
      const githubBranch = (next.githubBranch.trim() || 'main').slice(0, BLUEPRINT_LIMITS.MAX_BRANCH_LEN);
      const githubFilePath = (next.githubFilePath.trim() || 'cashflow/ledger.json').slice(
        0,
        BLUEPRINT_LIMITS.MAX_FILEPATH_LEN
      );

      const path = `users/${user.uid}`;
      const userRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userRef, {
          githubRepo,
          githubBranch,
          githubFilePath,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  const importTransactionsBatch = useCallback(
    async (items: TransactionInput[], baseOpeningBalance?: number | null) => {
      if (!user) throw new Error('Silakan masuk terlebih dahulu.');
      const cutoffDay = settings?.cutoffDay ?? 25;
      const chunkSize = 400;

      try {
        if (typeof baseOpeningBalance === 'number' && Number.isFinite(baseOpeningBalance)) {
          await updateDoc(doc(db, 'users', user.uid), {
            baseOpeningBalance: Math.round(baseOpeningBalance),
            updatedAt: serverTimestamp(),
          });
        }

        for (let i = 0; i < items.length; i += chunkSize) {
          const batch = writeBatch(db);
          const slice = items.slice(i, i + chunkSize);
          for (const item of slice) {
            const sanitized = sanitizeTransactionPayload(item, cutoffDay);
            const newRef = doc(collection(db, 'users', user.uid, 'transactions'));
            batch.set(newRef, {
              userId: user.uid,
              ...sanitized,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/transactions`);
      }
    },
    [user, settings?.cutoffDay]
  );

  return {
    user,
    authReady,
    authLoading,
    authError,
    settings,
    transactions,
    dataLoading,
    signInWithGoogle,
    signOutUser,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    updateBalanceSettings,
    updateGithubSettings,
    importTransactionsBatch,
  };
}
