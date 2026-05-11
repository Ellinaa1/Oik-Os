import { useMemo } from 'react';

export interface AuthUser {
  id?: string;
  email?: string;
  role: string;
}

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const getToken = (): string | null => {
  const tokenKeys = ['accessToken', 'token', 'jwt'];

  for (const key of tokenKeys) {
    const value = localStorage.getItem(key);
    if (value) {
      return value;
    }
  }

  return null;
};

export const useAuth = () => {
  const user = useMemo<AuthUser>(() => {
    const token = getToken();
    const payload = token ? decodeJwtPayload(token) : null;

    const role = typeof payload?.role === 'string' ? payload.role.toLowerCase() : 'member';
    const email = typeof payload?.email === 'string' ? payload.email : undefined;
    const id = typeof payload?.sub === 'string' ? payload.sub : undefined;

    return { id, email, role };
  }, []);

  return { user };
};
