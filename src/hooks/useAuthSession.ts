import { useEffect, useState } from 'react';
import type { AuthUser } from '../types';
import { API_BASE_URL } from '../utils/api';

interface AuthResponse {
  user: AuthUser | null;
}

function readableAuthError(error: unknown, fallback: string) {
  if (error instanceof TypeError || (error instanceof Error && error.message === 'Failed to fetch')) {
    return 'Impossibile contattare il server di gioco. Avvialo con npm run dev:server e riprova.';
  }

  return error instanceof Error ? error.message : fallback;
}

async function requestAuth(path: string, init?: RequestInit) {
  const hasBody = init?.body !== undefined;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: hasBody
      ? {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        }
      : init?.headers,
    ...init,
  });

  const payload = (await response.json().catch(() => ({}))) as AuthResponse & { message?: string };
  if (!response.ok) {
    throw new Error(payload.message ?? 'Richiesta di autenticazione fallita.');
  }

  return payload;
}

export function useAuthSession() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = async () => {
    try {
      const payload = await requestAuth('/auth/session');
      setUser(payload.user);
      setError(null);
    } catch (requestError) {
      const message = readableAuthError(requestError, 'Il server di autenticazione non e raggiungibile.');
      setUser(null);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshSession();
  }, []);

  const login = async (username: string, password: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = await requestAuth('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setUser(payload.user);
    } catch (requestError) {
      const message = readableAuthError(requestError, 'Login non riuscito.');
      setUser(null);
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = async () => {
    const previousUser = user;
    setIsSubmitting(true);
    setUser(null);
    setError(null);

    try {
      await requestAuth('/auth/logout', {
        method: 'POST',
        body: '{}',
      });
    } catch (requestError) {
      const message = readableAuthError(requestError, 'Logout non riuscito.');
      setUser(previousUser);
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    user,
    isLoading,
    isSubmitting,
    error,
    login,
    logout,
  };
}
