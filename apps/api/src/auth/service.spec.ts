import assert from 'node:assert/strict';
import test from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { db, type User } from '../db';
import { AuthService } from './service';

function createMockResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

test('googleLogin requires verified google identity', async () => {
  db.users.clear();
  const service = new AuthService(async () => createMockResponse({
    email: 'alice@example.com',
    name: 'Alice',
    email_verified: 'false',
  }));

  await assert.rejects(async () => {
    await service.googleLogin({ idToken: 'unverified-id-token' });
  }, UnauthorizedException);
});

test('googleLogin rejects takeover of email/password account', async () => {
  db.users.clear();
  const emailUser: User = {
    id: 'email-user',
    email: 'alice@example.com',
    displayName: 'Alice',
    profileImage: null,
    password: 'hash',
    provider: 'EMAIL',
  };
  db.users.set(emailUser.id, emailUser);

  const service = new AuthService(async () => createMockResponse({
    email: 'alice@example.com',
    name: 'Alice G',
    email_verified: 'true',
  }));

  await assert.rejects(async () => {
    await service.googleLogin({ idToken: 'valid-google-token' });
  }, UnauthorizedException);
});

test('getMe rejects tampered token signatures', async () => {
  db.users.clear();
  const service = new AuthService(async () => createMockResponse({}));
  const { token } = await service.signup({ email: 'bob@example.com', password: 'pass123', displayName: 'Bob' });

  const [payload] = token.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'attacker', email: 'attacker@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }), 'utf8').toString('base64url');
  const tamperedToken = `${tamperedPayload}.${payload}`;

  await assert.rejects(async () => {
    await service.getMe(tamperedToken);
  }, UnauthorizedException);
});
