'use client';

export type AuthSession = { accessToken: string; refreshToken: string; user: { id: string; email?: string } };

const storageKey = 'datewise.supabase.session';

export function readSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function writeSession(session: AuthSession) {
  localStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(storageKey);
}

async function supabasePost(path: string, body: unknown) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) throw new Error('Supabase env is missing');
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: anonKey },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function signUp(email: string, password: string) {
  return supabasePost('/auth/v1/signup', { email, password });
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  const data = (await supabasePost('/auth/v1/token?grant_type=password', { email, password })) as {
    access_token: string;
    refresh_token: string;
    user: { id: string; email?: string };
  };
  const session: AuthSession = { accessToken: data.access_token, refreshToken: data.refresh_token, user: data.user };
  writeSession(session);
  return session;
}

export function googleAuthUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const redirect = `${window.location.origin}/login`;
  return `${baseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}&apikey=${anonKey}`;
}
