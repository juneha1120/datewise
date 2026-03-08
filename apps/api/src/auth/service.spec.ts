import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from './service';
import { db } from '../db';

function makeGoogleTokenInfoResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

test.beforeEach(() => {
  db.users.clear();
});

test('google login rejects unverified identity payloads', async () => {
  const service = new AuthService();
  const originalFetch = global.fetch;
  global.fetch = async () => makeGoogleTokenInfoResponse(200, {
    sub: 'google-sub',
    email: 'user@example.com',
    email_verified: 'false',
    iss: 'https://accounts.google.com',
  });

  await assert.rejects(
    () => service.googleLogin({ idToken: 'fake-id-token' }),
    /Google identity verification failed/,
  );

  global.fetch = originalFetch;
});

test('google login creates google user from verified token info only', async () => {
  const service = new AuthService();
  const originalFetch = global.fetch;
  global.fetch = async () => makeGoogleTokenInfoResponse(200, {
    sub: 'google-sub',
    email: 'verified@example.com',
    email_verified: 'true',
    iss: 'accounts.google.com',
    name: 'Verified User',
    picture: 'https://example.com/pic.png',
  });

  const result = await service.googleLogin({ idToken: 'valid-id-token' });
  assert.equal(result.user.email, 'verified@example.com');
  assert.equal(result.user.provider, 'GOOGLE');
  assert.equal(result.user.displayName, 'Verified User');

  global.fetch = originalFetch;
});

test('google login does not overwrite existing password account provider', async () => {
  const service = new AuthService();
  await service.signup({ email: 'existing@example.com', password: 'pass123', displayName: 'Existing User' });

  const originalFetch = global.fetch;
  global.fetch = async () => makeGoogleTokenInfoResponse(200, {
    sub: 'google-sub',
    email: 'existing@example.com',
    email_verified: 'true',
    iss: 'accounts.google.com',
    name: 'Impostor',
  });

  await assert.rejects(
    () => service.googleLogin({ idToken: 'valid-id-token' }),
    /Email already registered with password login/,
  );

  global.fetch = originalFetch;
});

test('getMe rejects forged token and accepts signed token', async () => {
  const service = new AuthService();
  const signup = await service.signup({ email: 'signed@example.com', password: 'pass123', displayName: 'Signed User' });

  const me = await service.getMe(signup.token);
  assert.equal(me.email, 'signed@example.com');

  const forgedToken = Buffer.from(`${signup.user.id}:attacker@example.com`).toString('base64url');
  await assert.rejects(() => service.getMe(forgedToken), /Invalid token/);
});
