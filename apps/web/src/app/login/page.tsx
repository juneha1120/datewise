'use client';

import { useState } from 'react';
import { signIn, signUp } from '../../lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  return (
    <main className="mx-auto grid max-w-xl gap-3 p-6">
      <h1 className="text-3xl font-bold">Datewise Login</h1>
      <p className="text-slate-300">Sign up and login with email and password. Set your username from the profile page.</p>
      <input placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      <div className="flex gap-2">
        <button
          onClick={async () => {
            try {
              await signUp(email, password);
              setMessage('Signup successful. Redirecting to planner...');
              location.href = '/planner';
            } catch (error) {
              setMessage(`Signup failed: ${error instanceof Error ? error.message : 'unknown error'}`);
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
            } catch (error) {
              setMessage(`Login failed: ${error instanceof Error ? error.message : 'unknown error'}`);
            }
          }}
        >
          Login
        </button>
      </div>
      {message && <p>{message}</p>}
    </main>
  );
}
