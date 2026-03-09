'use client';

export type AuthSession = { accessToken: string; refreshToken: string; user: { id: string; email?: string } };

type AuthResponse = { token: string; user: { id: string; email?: string } };

const storageKey = 'datewise.auth.session';

function apiBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) throw new Error('API base URL is missing');
  return baseUrl;
}

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

async function apiPost(path: string, body: unknown): Promise<AuthResponse> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as AuthResponse;
}

function sessionFromAuthResponse(data: AuthResponse): AuthSession {
  return { accessToken: data.token, refreshToken: '', user: data.user };
}

export async function signUp(email: string, password: string, displayName = 'Datewise User'): Promise<AuthSession> {
  const data = await apiPost('/auth/signup', { email, password, displayName });
  const session = sessionFromAuthResponse(data);
  writeSession(session);
  return session;
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  const data = await apiPost('/auth/login', { email, password });
  const session = sessionFromAuthResponse(data);
  writeSession(session);
  return session;
}

export async function signInWithGoogle(email: string, displayName: string): Promise<AuthSession> {
  const data = await apiPost('/auth/google', { email, displayName, profileImage: null });
  const session = sessionFromAuthResponse(data);
  writeSession(session);
  return session;
}
