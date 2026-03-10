import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { db, type User } from '../db';
import { fetchWithRetry, type ExternalHttpError } from '../external.http';

export type AuthUser = { id: string; email: string; displayName: string; profileImage: string | null };
type SupabaseUser = { id: string; email?: string; user_metadata?: { full_name?: string; avatar_url?: string } };

function tokenFor(user: User) {
  return Buffer.from(`${user.id}:${user.email}`).toString('base64url');
}

function fallbackDisplayName(email: string) {
  const [name] = email.split('@');
  return name?.trim() ? name : 'Datewise User';
}

@Injectable()
export class AuthService {
  private supabaseCache = new Map<string, { user: SupabaseUser; expiresAt: number }>();

  async signup(input: { email: string; password: string; displayName?: string }) {
    const existing = [...db.users.values()].find((user) => user.email === input.email);
    if (existing) throw new UnauthorizedException('Email already registered');
    const user: User = {
      id: randomUUID(),
      email: input.email,
      displayName: input.displayName?.trim() || fallbackDisplayName(input.email),
      profileImage: null,
      password: createHash('sha256').update(input.password).digest('hex'),
      provider: 'EMAIL',
    };
    db.users.set(user.id, user);
    return { token: tokenFor(user), user };
  }

  async login(input: { email: string; password: string }) {
    const user = [...db.users.values()].find((entry) => entry.email === input.email && entry.provider === 'EMAIL');
    const passwordHash = createHash('sha256').update(input.password).digest('hex');
    if (!user || user.password !== passwordHash) throw new UnauthorizedException('Invalid credentials');
    return { token: tokenFor(user), user };
  }

  async googleLogin(input: { email: string; displayName: string; profileImage?: string }) {
    let user = [...db.users.values()].find((entry) => entry.email === input.email);
    if (!user) {
      user = { id: randomUUID(), email: input.email, displayName: input.displayName, profileImage: input.profileImage ?? null, provider: 'GOOGLE' };
    } else {
      user.displayName = input.displayName;
      user.profileImage = input.profileImage ?? user.profileImage;
      user.provider = 'GOOGLE';
    }
    db.users.set(user.id, user);
    return { token: tokenFor(user), user };
  }

  private parseLocalToken(token: string): { id: string; email: string } | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString();
      const [id, email] = decoded.split(':');
      if (!id || !email || !email.includes('@')) return null;
      return { id, email };
    } catch {
      return null;
    }
  }

  private getLocalUserFromToken(token: string): AuthUser | null {
    const parsed = this.parseLocalToken(token);
    if (!parsed) return null;
    const user = db.users.get(parsed.id);
    if (!user) return null;
    return { id: user.id, email: user.email, displayName: user.displayName, profileImage: user.profileImage };
  }

  private async fetchSupabaseUser(accessToken: string): Promise<SupabaseUser> {
    const cached = this.supabaseCache.get(accessToken);
    if (cached && cached.expiresAt > Date.now()) return cached.user;

    const url = `${process.env.SUPABASE_URL ?? ''}/auth/v1/user`;
    const apikey = process.env.SUPABASE_ANON_KEY ?? '';
    if (!url.startsWith('http') || !apikey) throw new UnauthorizedException('Supabase env not configured');

    let response: Response;
    try {
      response = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${accessToken}`, apikey } }, 5000, 2);
    } catch (error) {
      const mapped: ExternalHttpError = {
        provider: 'supabase',
        code: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error',
        message: error instanceof Error ? error.message : 'Unknown network error',
      };
      throw new UnauthorizedException(mapped);
    }

    if (!response.ok) {
      const mapped: ExternalHttpError = {
        provider: 'supabase',
        code: 'http_error',
        status: response.status,
        message: 'Supabase auth validation failed',
      };
      throw new UnauthorizedException(mapped);
    }

    const user = (await response.json()) as SupabaseUser;
    this.supabaseCache.set(accessToken, { user, expiresAt: Date.now() + 60_000 });
    return user;
  }

  private upsertSupabaseUser(user: SupabaseUser): AuthUser {
    const existing = db.users.get(user.id) ?? [...db.users.values()].find((entry) => entry.email === user.email);
    const next: User = {
      id: user.id,
      email: user.email ?? existing?.email ?? `${user.id}@supabase.local`,
      displayName: user.user_metadata?.full_name ?? existing?.displayName ?? 'Datewise User',
      profileImage: user.user_metadata?.avatar_url ?? existing?.profileImage ?? null,
      provider: 'GOOGLE',
    };
    db.users.set(next.id, next);
    return { id: next.id, email: next.email, displayName: next.displayName, profileImage: next.profileImage };
  }

  async getMe(token: string): Promise<AuthUser> {
    const local = this.getLocalUserFromToken(token);
    if (local) return local;

    const parsedLocal = this.parseLocalToken(token);
    if (parsedLocal) {
      throw new UnauthorizedException('Local session expired. Please login again.');
    }

    const supabaseUser = await this.fetchSupabaseUser(token);
    return this.upsertSupabaseUser(supabaseUser);
  }

  async updateDisplayName(token: string, displayName: string): Promise<AuthUser> {
    const nextName = displayName.trim();
    if (!nextName) throw new BadRequestException('Display name cannot be empty');
    const me = await this.getMe(token);
    const existing = db.users.get(me.id);
    if (!existing) throw new UnauthorizedException('User not found');
    existing.displayName = nextName;
    db.users.set(existing.id, existing);
    return { id: existing.id, email: existing.email, displayName: existing.displayName, profileImage: existing.profileImage };
  }

  async profile(token: string) {
    const me = await this.getMe(token);
    const mine = [...db.itineraries.values()].filter((entry) => entry.userId === me.id);
    const saved = [...db.saved.values()].filter((entry) => entry.userId === me.id);
    return { user: me, itineraries: mine, saved };
  }
}
