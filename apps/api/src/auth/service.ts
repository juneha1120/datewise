import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { db, type User } from '../db';

export type AuthUser = { id: string; email: string; displayName: string; profileImage: string | null };

function tokenFor(user: User) {
  return Buffer.from(`${user.id}:${user.email}`).toString('base64url');
}

@Injectable()
export class AuthService {
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

  async getMe(token: string): Promise<AuthUser> {
    const decoded = Buffer.from(token, 'base64url').toString();
    const [id] = decoded.split(':');
    const user = db.users.get(id);
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
