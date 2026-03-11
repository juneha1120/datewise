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

test('creates a Google-authenticated session from profile details', async () => {
  const auth = new AuthService();

  const { token, user } = await auth.googleLogin({
    email: 'google-user@example.com',
    displayName: 'Google User',
    profileImage: 'https://images.example.com/avatar.png',
  });
  const me = await auth.getMe(token);

  assert.equal(user.email, 'google-user@example.com');
  assert.equal(user.displayName, 'Google User');
  assert.equal(user.profileImage, 'https://images.example.com/avatar.png');
  assert.equal(me.id, user.id);

  db.users.clear();
  db.itineraries.clear();
  db.saved.clear();
});

test('signup can derive display name from email when omitted', async () => {
  const auth = new AuthService();
  const { user } = await auth.signup({ email: 'sam@example.com', password: 'pw123' });
  assert.equal(user.displayName, 'sam');

  db.users.clear();
  db.itineraries.clear();
  db.saved.clear();
});

test('allows updating display name after signup', async () => {
  const auth = new AuthService();
  const { token } = await auth.signup({ email: 'profile@example.com', password: 'pw123' });
  const updated = await auth.updateDisplayName(token, 'New Username');

  assert.equal(updated.displayName, 'New Username');
  const me = await auth.getMe(token);
  assert.equal(me.displayName, 'New Username');

  db.users.clear();
  db.itineraries.clear();
  db.saved.clear();
});


test('returns local session expired when token belongs to cleared in-memory user', async () => {
  const auth = new AuthService();
  const { token } = await auth.signup({ email: 'stale@example.com', password: 'pw123' });
  db.users.clear();

  await assert.rejects(() => auth.getMe(token), /Local session expired/);

  db.users.clear();
  db.itineraries.clear();
  db.saved.clear();
});
