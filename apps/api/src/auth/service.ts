import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { db, type User } from '../db';

export type AuthUser = { id: string; email: string; displayName: string; profileImage: string | null };

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string;
  name?: string;
  picture?: string;
};

function encodeJwtPart(value: object) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function timingSafeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function tokenFor(user: User, secret: string) {
  const header = encodeJwtPart({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJwtPart({
    sub: user.id,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
  });
  const signingInput = `${header}.${payload}`;
  const signature = createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

@Injectable()
export class AuthService {
  private jwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new InternalServerErrorException('JWT_SECRET is required');
    return secret;
  }

  private async verifyGoogleIdentity(idToken: string): Promise<Required<Pick<User, 'email' | 'displayName' | 'profileImage'>>> {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) throw new InternalServerErrorException('GOOGLE_OAUTH_CLIENT_ID is required');

    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) throw new UnauthorizedException('Invalid Google token');
    const tokenInfo = (await response.json()) as GoogleTokenInfo;
    if (!tokenInfo.email || tokenInfo.email_verified !== 'true') {
      throw new UnauthorizedException('Google account email must be verified');
    }
    if (!tokenInfo.aud || !timingSafeEqualString(tokenInfo.aud, clientId)) {
      throw new UnauthorizedException('Google token audience mismatch');
    }
    return {
      email: tokenInfo.email,
      displayName: tokenInfo.name ?? tokenInfo.email,
      profileImage: tokenInfo.picture ?? null,
    };
  }

  async signup(input: { email: string; password: string; displayName: string }) {
    const existing = [...db.users.values()].find((user) => user.email === input.email);
    if (existing) throw new UnauthorizedException('Email already registered');
    const user: User = {
      id: randomUUID(),
      email: input.email,
      displayName: input.displayName,
      profileImage: null,
      password: createHash('sha256').update(input.password).digest('hex'),
      provider: 'EMAIL',
    };
    db.users.set(user.id, user);
    return { token: tokenFor(user, this.jwtSecret()), user };
  }

  async login(input: { email: string; password: string }) {
    const user = [...db.users.values()].find((entry) => entry.email === input.email && entry.provider === 'EMAIL');
    const passwordHash = createHash('sha256').update(input.password).digest('hex');
    if (!user || user.password !== passwordHash) throw new UnauthorizedException('Invalid credentials');
    return { token: tokenFor(user, this.jwtSecret()), user };
  }

  async googleLogin(input: { idToken: string }) {
    const googleProfile = await this.verifyGoogleIdentity(input.idToken);
    let user = [...db.users.values()].find((entry) => entry.email === googleProfile.email);
    if (!user) {
      user = {
        id: randomUUID(),
        email: googleProfile.email,
        displayName: googleProfile.displayName,
        profileImage: googleProfile.profileImage,
        provider: 'GOOGLE',
      };
    } else {
      user.displayName = googleProfile.displayName;
      user.profileImage = googleProfile.profileImage;
      user.provider = 'GOOGLE';
    }
    db.users.set(user.id, user);
    return { token: tokenFor(user, this.jwtSecret()), user };
  }

  async getMe(token: string): Promise<AuthUser> {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) throw new UnauthorizedException('Invalid token');

    const signingInput = `${header}.${payload}`;
    const expectedSignature = createHmac('sha256', this.jwtSecret()).update(signingInput).digest('base64url');
    if (!timingSafeEqualString(signature, expectedSignature)) throw new UnauthorizedException('Invalid token');

    let decoded: { sub?: string; exp?: number };
    try {
      decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
    if (!decoded.sub || !decoded.exp || decoded.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Invalid token');
    }

    const user = db.users.get(decoded.sub);
    if (!user) throw new UnauthorizedException('Invalid token');
    return { id: user.id, email: user.email, displayName: user.displayName, profileImage: user.profileImage };
  }

  async profile(token: string) {
    const me = await this.getMe(token);
    const mine = [...db.itineraries.values()].filter((entry) => entry.userId === me.id);
    const saved = [...db.saved.values()].filter((entry) => entry.userId === me.id);
    return { user: me, itineraries: mine, saved };
  }
}
