'use client';

import { useState } from 'react';
import { signIn, signInWithGoogle, signUp } from '../../lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('Datewise User');
  const [message, setMessage] = useState('');

  return (
    <main className="mx-auto grid max-w-xl gap-3 p-6">
      <h1 className="text-3xl font-bold">Datewise Login</h1>
      <input placeholder="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      <input placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      <div className="flex gap-2">
        <button
          onClick={async () => {
            try {
              await signUp(email, password, displayName);
              setMessage('Signup successful. Redirecting to planner...');
              location.href = '/planner';
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
        <button
          onClick={async () => {
            try {
              await signInWithGoogle(email, displayName);
              location.href = '/planner';
            } catch {
              setMessage('Google login failed.');
            }
          }}
        >
          Google login (mock)
        </button>
      </div>
      {message && <p>{message}</p>}
    </main>
  );
}
