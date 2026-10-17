import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getAccount, type Account } from './database';
import { getActiveAccountId, setActiveAccountId } from './preferences';

interface AccountContextValue {
  /** Compte actif, ou null tant qu'aucun profil n'est choisi (→ écran de choix). */
  accountId: number | null;
  /** Profil complet du compte actif (null si aucun). */
  account: Account | null;
  /** false tant que le compte actif n'a pas été relu depuis les préférences. */
  ready: boolean;
  /** Choisit un compte comme actif (au lancement ou depuis la gestion des comptes). */
  select: (id: number) => Promise<void>;
  /** Recharge le profil actif depuis la base (après édition). */
  reload: () => Promise<void>;
  /** Revient au choix du compte (déconnexion). */
  clear: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

/**
 * Fournit le compte actif à toute l'app. L'id est persisté en préférences ;
 * le profil est relu en base. Aucun id → l'app affiche l'écran de choix du compte.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [accountId, setAccountId] = useState<number | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const stored = await getActiveAccountId();
    if (stored === null) {
      setAccountId(null);
      setAccount(null);
      setReady(true);
      return;
    }
    const row = await getAccount(db, stored);
    if (!row) {
      // Le compte a été supprimé : on retombe sur le choix du compte.
      await setActiveAccountId(null);
      setAccountId(null);
      setAccount(null);
    } else {
      setAccountId(stored);
      setAccount(row);
    }
    setReady(true);
  }, [db]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const select = useCallback(
    async (id: number) => {
      await setActiveAccountId(id);
      await reload();
    },
    [reload]
  );

  const clear = useCallback(async () => {
    await setActiveAccountId(null);
    setAccountId(null);
    setAccount(null);
  }, []);

  const value = useMemo<AccountContextValue>(
    () => ({ accountId, account, ready, select, reload, clear }),
    [accountId, account, ready, select, reload, clear]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

/** Accès au compte actif depuis un écran (doit être sous `AccountProvider`). */
export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount doit être utilisé dans un AccountProvider.');
  return value;
}
