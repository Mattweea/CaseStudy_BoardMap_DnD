import { useEffect, useState } from 'react';
import type { AuthUser } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

interface AuthResponse {
  user: AuthUser | null;
}

async function requestAuth(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
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
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Il server di autenticazione non e raggiungibile.';
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
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = await requestAuth('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setUser(payload.user);
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Login non riuscito.';
      setUser(null);
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = async () => {
    setIsSubmitting(true);

    try {
      await requestAuth('/auth/logout', {
        method: 'POST',
      });
      setUser(null);
      setError(null);
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Logout non riuscito.';
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
