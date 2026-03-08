import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthService } from './service';
import { db } from '../db';

test('rejects forged bearer tokens', async () => {
  process.env.JWT_SECRET = 'unit-test-secret';
  const auth = new AuthService();
  const { user } = await auth.signup({ email: 'forged@example.com', password: 'pass123', displayName: 'Forged' });

  const forgedPayload = Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 60 }), 'utf8').toString('base64url');
  const forgedToken = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString('base64url')}.${forgedPayload}.invalid-signature`;

  await assert.rejects(() => auth.getMe(forgedToken));

  db.users.clear();
  db.itineraries.clear();
  db.saved.clear();
});

test('verifies Google token before creating a session', async () => {
  process.env.JWT_SECRET = 'unit-test-secret';
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id-123';

  const auth = new AuthService();
  const originalFetch = global.fetch;
  global.fetch = async () =>
    ({
      ok: true,
      async json() {
        return {
          aud: 'client-id-123',
          email: 'google-user@example.com',
          email_verified: 'true',
          name: 'Google User',
          picture: 'https://images.example.com/avatar.png',
        };
      },
    }) as Response;

  const { token, user } = await auth.googleLogin({ idToken: 'valid-google-id-token' });
  const me = await auth.getMe(token);

  assert.equal(user.email, 'google-user@example.com');
  assert.equal(me.id, user.id);

  global.fetch = originalFetch;
  db.users.clear();
  db.itineraries.clear();
  db.saved.clear();
});
