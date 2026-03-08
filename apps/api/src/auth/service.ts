import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { db, type User } from '../db';

export type AuthUser = { id: string; email: string; displayName: string; profileImage: string | null };

type TokenPayload = { sub: string; email: string; exp: number };

type GoogleIdentity = { email: string; displayName: string; profileImage: string | null };

const TOKEN_TTL_SECONDS = 60 * 60 * 24;
const TOKEN_TIMEOUT_MS = 4_500;
const TOKEN_MAX_RETRIES = 2;
const GOOGLE_TOKEN_INFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

const googleTokenInfoSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
  email_verified: z.union([z.literal('true'), z.literal('false'), z.boolean()]).optional(),
  aud: z.string().optional(),
});

const defaultFetch: typeof fetch = (...args) => fetch(...args);

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function toAuthUser(user: User): AuthUser {
  return { id: user.id, email: user.email, displayName: user.displayName, profileImage: user.profileImage };
}

@Injectable()
export class AuthService {
  private readonly tokenSecret: string;

  constructor(private readonly fetchImpl: typeof fetch = defaultFetch) {
    this.tokenSecret = process.env.AUTH_TOKEN_SECRET ?? 'datewise-dev-auth-secret';
  }

  private sign(payloadBase64: string): string {
    return createHmac('sha256', this.tokenSecret).update(payloadBase64).digest('base64url');
  }

  private tokenFor(user: User): string {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    };
    const payloadBase64 = base64UrlEncode(JSON.stringify(payload));
    const signature = this.sign(payloadBase64);
    return `${payloadBase64}.${signature}`;
  }

  private parseToken(token: string): TokenPayload {
    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || !signature) {
      throw new UnauthorizedException('Invalid token');
    }

    const expectedSignature = this.sign(payloadBase64);
    const isValidSignature = expectedSignature.length === signature.length && timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
    if (!isValidSignature) {
      throw new UnauthorizedException('Invalid token');
    }

    let payload: TokenPayload;
    try {
      payload = z.object({ sub: z.string().min(1), email: z.string().email(), exp: z.number().int().positive() }).parse(JSON.parse(base64UrlDecode(payloadBase64)));
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Token expired');
    }

    return payload;
  }

  private async verifyGoogleIdentity(idToken: string): Promise<GoogleIdentity> {
    for (let attempt = 0; attempt <= TOKEN_MAX_RETRIES; attempt += 1) {
      try {
        const response = await this.fetchImpl(`${GOOGLE_TOKEN_INFO_URL}?id_token=${encodeURIComponent(idToken)}`, {
          signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
        });

        if (!response.ok) {
          throw new UnauthorizedException({ code: 'GOOGLE_TOKEN_INVALID', message: 'Unable to validate Google token' });
        }

        const parsed = googleTokenInfoSchema.parse(await response.json());
        const isVerifiedEmail = parsed.email_verified === true || parsed.email_verified === 'true';
        if (!isVerifiedEmail) {
          throw new UnauthorizedException({ code: 'GOOGLE_EMAIL_UNVERIFIED', message: 'Google account email is not verified' });
        }

        const requiredAudience = process.env.GOOGLE_CLIENT_ID;
        if (requiredAudience && parsed.aud !== requiredAudience) {
          throw new UnauthorizedException({ code: 'GOOGLE_TOKEN_AUDIENCE_MISMATCH', message: 'Google token audience mismatch' });
        }

        return {
          email: parsed.email,
          displayName: parsed.name ?? parsed.email.split('@')[0],
          profileImage: parsed.picture ?? null,
        };
      } catch (error) {
        if (error instanceof UnauthorizedException) throw error;
        if (attempt === TOKEN_MAX_RETRIES) {
          throw new UnauthorizedException({ code: 'GOOGLE_TOKEN_VERIFICATION_FAILED', message: 'Google identity verification failed' });
        }
      }
    }

    throw new UnauthorizedException({ code: 'GOOGLE_TOKEN_VERIFICATION_FAILED', message: 'Google identity verification failed' });
  }

  async signup(input: { email: string; password: string; displayName: string }) {
    const existing = [...db.users.values()].find((user) => user.email === input.email);
    if (existing) throw new UnauthorizedException('Email already registered');
    const user: User = { id: randomUUID(), email: input.email, displayName: input.displayName, profileImage: null, password: createHash('sha256').update(input.password).digest('hex'), provider: 'EMAIL' };
    db.users.set(user.id, user);
    return { token: this.tokenFor(user), user };
  }

  async login(input: { email: string; password: string }) {
    const user = [...db.users.values()].find((entry) => entry.email === input.email && entry.provider === 'EMAIL');
    const passwordHash = createHash('sha256').update(input.password).digest('hex');
    if (!user || user.password !== passwordHash) throw new UnauthorizedException('Invalid credentials');
    return { token: this.tokenFor(user), user };
  }

  async googleLogin(input: { idToken: string }) {
    const identity = await this.verifyGoogleIdentity(input.idToken);
    let user = [...db.users.values()].find((entry) => entry.email === identity.email);

    if (!user) {
      user = { id: randomUUID(), email: identity.email, displayName: identity.displayName, profileImage: identity.profileImage, provider: 'GOOGLE' };
    } else if (user.provider !== 'GOOGLE') {
      throw new UnauthorizedException({ code: 'ACCOUNT_PROVIDER_MISMATCH', message: 'Use your email/password login for this account' });
    } else {
      user.displayName = identity.displayName;
      user.profileImage = identity.profileImage ?? user.profileImage;
    }

    db.users.set(user.id, user);
    return { token: this.tokenFor(user), user };
  }

  async getMe(token: string): Promise<AuthUser> {
    const payload = this.parseToken(token);
    const user = db.users.get(payload.sub);
    if (!user || user.email !== payload.email) throw new UnauthorizedException('Invalid token');
    return toAuthUser(user);
  }
}
