import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { prisma, type User } from '../db';
import { mapAuthUser, mapItineraryRecord, mapSavedRecord } from '../persistence';
import { fetchWithRetry, type ExternalHttpError } from '../external-http';

export type AuthUser = { id: string; email: string; displayName: string; profileImage: string | null };
type SupabaseUser = { id: string; email?: string; user_metadata?: { full_name?: string; avatar_url?: string } };
type GoogleTokenInfo = {
  email: string;
  name?: string;
  picture?: string;
  email_verified?: 'true' | 'false';
  iss?: string;
  aud?: string;
};

function tokenFor(user: Pick<User, 'id' | 'email'>) {
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
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new UnauthorizedException('Email already registered');

    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: input.email,
        displayName: input.displayName?.trim() || fallbackDisplayName(input.email),
        profileImage: null,
        passwordHash: createHash('sha256').update(input.password).digest('hex'),
        authProvider: 'EMAIL',
      },
    });

    return { token: tokenFor(user), user: mapAuthUser(user) };
  }

  async login(input: { email: string; password: string }) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    const passwordHash = createHash('sha256').update(input.password).digest('hex');
    if (!user || user.authProvider !== 'EMAIL' || user.passwordHash !== passwordHash) throw new UnauthorizedException('Invalid credentials');
    return { token: tokenFor(user), user: mapAuthUser(user) };
  }

  private async verifyGoogleIdToken(idToken: string): Promise<GoogleTokenInfo> {
    if (!idToken?.trim()) throw new UnauthorizedException('Missing Google ID token');

    let response: Response;
    try {
      response = await fetchWithRetry(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {}, 5000, 2);
    } catch (error) {
      const mapped: ExternalHttpError = {
        provider: 'supabase',
        code: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error',
        message: error instanceof Error ? error.message : 'Unknown network error',
      };
      throw new UnauthorizedException(mapped);
    }

    if (!response.ok) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    const tokenInfo = (await response.json()) as GoogleTokenInfo;
    if (!tokenInfo.email || tokenInfo.email_verified !== 'true') throw new UnauthorizedException('Google email must be verified');

    const issuer = tokenInfo.iss;
    if (issuer !== 'accounts.google.com' && issuer !== 'https://accounts.google.com') {
      throw new UnauthorizedException('Invalid Google token issuer');
    }

    const expectedAudience = process.env.GOOGLE_CLIENT_ID?.trim();
    if (expectedAudience && tokenInfo.aud !== expectedAudience) {
      throw new UnauthorizedException('Google token audience mismatch');
    }

    return tokenInfo;
  }

  async googleLogin(input: { idToken: string }) {
    const tokenInfo = await this.verifyGoogleIdToken(input.idToken);
    const displayName = tokenInfo.name?.trim() || fallbackDisplayName(tokenInfo.email);

    const user = await prisma.user.upsert({
      where: { email: tokenInfo.email },
      update: {
        displayName,
        profileImage: tokenInfo.picture ?? null,
        authProvider: 'GOOGLE',
      },
      create: {
        id: randomUUID(),
        email: tokenInfo.email,
        displayName,
        profileImage: tokenInfo.picture ?? null,
        authProvider: 'GOOGLE',
      },
    });

    return { token: tokenFor(user), user: mapAuthUser(user) };
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

  private async getLocalUserFromToken(token: string): Promise<AuthUser | null> {
    const parsed = this.parseLocalToken(token);
    if (!parsed) return null;
    const user = await prisma.user.findUnique({ where: { id: parsed.id } });
    if (!user) return null;
    return mapAuthUser(user);
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

  private async upsertSupabaseUser(user: SupabaseUser): Promise<AuthUser> {
    const email = user.email ?? `${user.id}@supabase.local`;
    const existing = await prisma.user.findUnique({ where: { email } });

    const next = await prisma.user.upsert({
      where: { email },
      update: {
        displayName: user.user_metadata?.full_name ?? existing?.displayName ?? 'Datewise User',
        profileImage: user.user_metadata?.avatar_url ?? existing?.profileImage ?? null,
        authProvider: 'GOOGLE',
      },
      create: {
        id: existing?.id ?? user.id,
        email,
        displayName: user.user_metadata?.full_name ?? existing?.displayName ?? 'Datewise User',
        profileImage: user.user_metadata?.avatar_url ?? existing?.profileImage ?? null,
        authProvider: 'GOOGLE',
      },
    });

    return mapAuthUser(next);
  }

  async getMe(token: string): Promise<AuthUser> {
    const local = await this.getLocalUserFromToken(token);
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
    const existing = await prisma.user.findUnique({ where: { id: me.id } });
    if (!existing) throw new UnauthorizedException('User not found');

    const updated = await prisma.user.update({ where: { id: me.id }, data: { displayName: nextName } });
    return mapAuthUser(updated);
  }

  async profile(token: string) {
    const me = await this.getMe(token);
    const [mine, saved] = await Promise.all([
      prisma.itinerary.findMany({ where: { userId: me.id }, include: { slots: true }, orderBy: { createdAt: 'desc' } }),
      prisma.savedItinerary.findMany({
        where: { userId: me.id },
        include: { itinerary: { include: { slots: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { user: me, itineraries: mine.map(mapItineraryRecord), saved: saved.map(mapSavedRecord) };
  }
}
