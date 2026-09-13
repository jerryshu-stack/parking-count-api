import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as authApi from '@/api/auth';
import { setSessionToken, setUnauthorizedHandler } from '@/api/client';
import { fetchMe } from '@/api/parking';
import { clearToken, readToken, writeToken } from './tokenStore';
import type { MeResponse } from '@/api/types';

/**
 * Session state for the whole app.
 *
 * The token goes to expo-secure-store (Keychain / Android Keystore), never
 * AsyncStorage. Backend sessions have no expiry column, so the only way a token
 * dies is logout or revocation -- which surfaces as a 401. The client calls the
 * unauthorized handler registered here, and we drop straight back to the entry
 * screen rather than trying to refresh something that cannot be refreshed.
 */

interface AuthState {
  /** null until the stored token has been read and probed. */
  ready: boolean;
  username: string | null;
  /** Whether community reports are currently visible to this user. */
  unlocked: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-reads /me. Called after a contribution, and when the app returns to focus. */
  refresh: () => Promise<MeResponse | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const signingOut = useRef(false);

  const clear = useCallback(async () => {
    setSessionToken(null);
    setUsername(null);
    setUnlocked(false);
    await clearToken();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUsername(me.username);
      setUnlocked(me.unlock_active);
      return me;
    } catch {
      return null;
    }
  }, []);

  // A 401 from anywhere means the session is gone for good.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (signingOut.current) return;
      void clear();
    });
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  // Cold start: restore the token, then confirm it still works before routing.
  useEffect(() => {
    (async () => {
      try {
        const stored = await readToken();
        if (stored) {
          setSessionToken(stored);
          const me = await refresh();
          if (!me) await clear();
        }
      } finally {
        setReady(true);
      }
    })();
  }, [refresh, clear]);

  const adopt = useCallback(
    async (session: { token: string; username: string }) => {
      await writeToken(session.token);
      setSessionToken(session.token);
      setUsername(session.username);
      await refresh();
    },
    [refresh],
  );

  const signIn = useCallback(
    async (name: string, password: string) => {
      const session = await authApi.login(name, password);
      await adopt(session);
    },
    [adopt],
  );

  const signUp = useCallback(
    async (name: string, password: string) => {
      const session = await authApi.register(name, password);
      await adopt(session);
    },
    [adopt],
  );

  const signOut = useCallback(async () => {
    signingOut.current = true;
    try {
      await authApi.logout().catch(() => {});
      await clear();
    } finally {
      signingOut.current = false;
    }
  }, [clear]);

  const value = useMemo<AuthState>(
    () => ({ ready, username, unlocked, signIn, signUp, signOut, refresh }),
    [ready, username, unlocked, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
