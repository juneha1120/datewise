'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn, signInWithGoogle, signUp } from '../../lib/auth';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: { theme: string; size: string; text: string }) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const nextPath = searchParams.get('next') || '/planner';

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;

    const initializeGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          if (!credential) return setMessage('Google login failed: missing credential token.');
          try {
            await signInWithGoogle(credential);
            location.href = nextPath;
          } catch (error) {
            setMessage(`Google login failed: ${error instanceof Error ? error.message : 'unknown error'}`);
          }
        },
      });

      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large', text: 'continue_with' });
    };

    if (window.google?.accounts?.id) {
      initializeGoogleButton();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleButton;
    document.body.appendChild(script);
    return () => script.remove();
  }, [googleClientId, nextPath]);

  return (
    <main className="mx-auto grid max-w-xl gap-3 p-6">
      <h1 className="text-3xl font-bold">Datewise Login</h1>
      <p className="text-slate-300">Sign up and login with email/password or Google. Set your username from the profile page.</p>
      {googleClientId ? <div ref={googleButtonRef} className="w-full" /> : <p className="text-amber-300 text-sm">Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google login.</p>}
      <input placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      <div className="flex gap-2">
        <button
          onClick={async () => {
            try {
              await signUp(email, password);
              setMessage('Signup successful. Redirecting to planner...');
              location.href = nextPath;
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
              location.href = nextPath;
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
