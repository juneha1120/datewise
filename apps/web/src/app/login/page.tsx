'use client';

import { useEffect, useState } from 'react';
import { googleAuthUrl, signIn, signUp, writeSession } from '../../lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    if (!accessToken || !refreshToken) return;

    writeSession({ accessToken, refreshToken, user: { id: hash.get('provider_token') ?? 'oauth-user' } });
    setMessage('Google login successful. Redirecting to planner...');
    window.location.hash = '';
    setTimeout(() => {
      location.href = '/planner';
    }, 300);
  }, []);

  return (
    <main className="mx-auto grid max-w-xl gap-3 p-6">
      <h1 className="text-3xl font-bold">Datewise Login</h1>
      <input placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      <div className="flex gap-2">
        <button
          onClick={async () => {
            try {
              await signUp(email, password);
              setMessage('Signup successful. You can now log in.');
            } catch {
              setMessage('Signup failed.');
            }
          }}
        >
          Sign up
        </button>
        <button
          onClick={async () => {
            try {
              await signIn(email, password);
              location.href = '/planner';
            } catch {
              setMessage('Login failed.');
            }
          }}
        >
          Login
        </button>
        <button onClick={() => (location.href = googleAuthUrl())}>Google OAuth</button>
      </div>
      {message && <p>{message}</p>}
    </main>
  );
}
