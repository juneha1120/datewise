'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn, signUp } from '../../lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function handle(action: 'signup' | 'login') {
    setBusy(true);
    setMessage('');

    try {
      if (action === 'signup') {
        await signUp(email, password);
        setMessage('Account created. Redirecting to planner...');
      } else {
        await signIn(email, password);
        setMessage('Logged in. Redirecting to planner...');
      }

      window.location.href = '/planner';
    } catch (error) {
      setMessage(`${action === 'signup' ? 'Signup' : 'Login'} failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="hero-grid">
      <section className="hero">
        <p className="eyebrow">Authentication</p>
        <h1 className="page-title">Sign in to save, publish, and collect itineraries.</h1>
        <p className="lede">The current MVP supports email signup and login. You can generate routes without an account, but saved and public flows require a session.</p>
        <div className="actions">
          <Link href="/planner" className="button-secondary">Continue without login</Link>
          <Link href="/public" className="button-ghost">See public itineraries</Link>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Email login</p>
            <h2 className="section-title">Create an account or sign back in</h2>
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" placeholder="Choose a password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>

          <div className="actions">
            <button className="button-primary" onClick={() => handle('signup')} disabled={busy}>Sign up</button>
            <button className="button-secondary" onClick={() => handle('login')} disabled={busy}>Login</button>
          </div>

          {message && <p className={`status-message ${message.toLowerCase().includes('failed') ? 'error' : 'success'}`}>{message}</p>}
        </div>
      </section>
    </main>
  );
}
