import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { db, type User } from '../db';

export type AuthUser = { id: string; email: string; displayName: string; profileImage: string | null };

const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET ?? 'datewise-dev-auth-secret';
const AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const GOOGLE_TOKEN_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

type TokenPayload = { sub: string; email: string; exp: number };

type GoogleTokenInfo = {
  sub?: string;
  email?: string;
  email_verified?: 'true' | 'false' | boolean;
  name?: string;
  picture?: string;
  iss?: string;
};

function signatureFor(payloadBase64: string) {
  return createHmac('sha256', AUTH_TOKEN_SECRET).update(payloadBase64).digest('base64url');
}

function tokenFor(user: User) {
  const payloadBase64 = Buffer.from(JSON.stringify({
    sub: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + AUTH_TOKEN_TTL_SECONDS,
  } satisfies TokenPayload)).toString('base64url');
  return `${payloadBase64}.${signatureFor(payloadBase64)}`;
}

function payloadFromToken(token: string): TokenPayload {
  const [payloadBase64, signature] = token.split('.');
  if (!payloadBase64 || !signature) throw new UnauthorizedException('Invalid token');
  const expectedSignature = signatureFor(payloadBase64);
  const providedSignature = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (providedSignature.length !== expectedSignatureBuffer.length) {
    throw new UnauthorizedException('Invalid token');
  }
  const signatureOk = timingSafeEqual(providedSignature, expectedSignatureBuffer);
  if (!signatureOk) throw new UnauthorizedException('Invalid token');

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString()) as TokenPayload;
  } catch {
    throw new UnauthorizedException('Invalid token');
  }
  if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new UnauthorizedException('Invalid token');
  }
  return payload;
}

@Injectable()
export class AuthService {
  async signup(input: { email: string; password: string; displayName: string }) {
    const existing = [...db.users.values()].find((user) => user.email === input.email);
    if (existing) throw new UnauthorizedException('Email already registered');
    const user: User = { id: randomUUID(), email: input.email, displayName: input.displayName, profileImage: null, password: createHash('sha256').update(input.password).digest('hex'), provider: 'EMAIL' };
    db.users.set(user.id, user);
    return { token: tokenFor(user), user };
  }

  async login(input: { email: string; password: string }) {
    const user = [...db.users.values()].find((entry) => entry.email === input.email && entry.provider === 'EMAIL');
    const passwordHash = createHash('sha256').update(input.password).digest('hex');
    if (!user || user.password !== passwordHash) throw new UnauthorizedException('Invalid credentials');
    return { token: tokenFor(user), user };
  }

  async googleLogin(input: { idToken: string }) {
    const googleUser = await this.verifyGoogleIdentity(input.idToken);
    let user = [...db.users.values()].find((entry) => entry.email === googleUser.email);
    if (!user) {
      user = {
        id: randomUUID(),
        email: googleUser.email,
        displayName: googleUser.displayName,
        profileImage: googleUser.profileImage,
        provider: 'GOOGLE',
      };
    } else {
      if (user.provider !== 'GOOGLE') {
        throw new UnauthorizedException('Email already registered with password login');
      }
      user.displayName = googleUser.displayName;
      user.profileImage = googleUser.profileImage ?? user.profileImage;
    }
    db.users.set(user.id, user);
    return { token: tokenFor(user), user };
  }

  async getMe(token: string): Promise<AuthUser> {
    const payload = payloadFromToken(token);
    const user = db.users.get(payload.sub);
    if (!user) throw new UnauthorizedException('Invalid token');
    return { id: user.id, email: user.email, displayName: user.displayName, profileImage: user.profileImage };
  }

  private async verifyGoogleIdentity(idToken: string): Promise<{ email: string; displayName: string; profileImage: string | null }> {
    const response = await this.fetchGoogleTokenInfo(idToken);
    const emailVerified = response.email_verified === true || response.email_verified === 'true';
    if (!response.sub || !response.email || !emailVerified || !response.iss || !GOOGLE_TOKEN_ISSUERS.has(response.iss)) {
      throw new UnauthorizedException('Google identity verification failed');
    }
    return {
      email: response.email,
      displayName: response.name ?? response.email,
      profileImage: response.picture ?? null,
    };
  }

  private async fetchGoogleTokenInfo(idToken: string): Promise<GoogleTokenInfo> {
    const url = `${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (response.ok) {
          return await response.json() as GoogleTokenInfo;
        }
        if (response.status >= 400 && response.status < 500) {
          throw new UnauthorizedException('Google identity verification failed');
        }
        lastError = new Error(`GOOGLE_TOKENINFO_HTTP_${response.status}`);
      } catch (error) {
        if (error instanceof UnauthorizedException) throw error;
        if (error instanceof Error) {
          lastError = new Error(error.name === 'AbortError' ? 'GOOGLE_TOKENINFO_TIMEOUT' : `GOOGLE_TOKENINFO_NETWORK_${error.message}`);
        } else {
          lastError = new Error('GOOGLE_TOKENINFO_UNKNOWN');
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new UnauthorizedException(`Google identity verification unavailable: ${lastError?.message ?? 'GOOGLE_TOKENINFO_FAILED'}`);
  }
}
