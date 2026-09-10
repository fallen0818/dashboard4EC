import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        router.push('/');
      } else {
        await signUp(email, password);
        setMessage('Account created. Check your email to confirm, then sign in.');
        setMode('signin');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#08091C] text-[#F5F0FF] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="font-mono text-xs tracking-[0.2em] text-[#9CA3D9] uppercase mb-2 text-center">
          Cooperative Report
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-center mb-8">
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="font-mono text-xs text-[#FF4D6D]">{error}</p>}
          {message && <p className="font-mono text-xs text-[#22F0B0]">{message}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#F5F0FF] text-[#08091C] font-medium py-2.5 rounded hover:bg-white transition-colors disabled:opacity-50"
          >
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setMessage(null);
          }}
          className="w-full text-center font-mono text-xs text-[#9CA3D9] hover:text-[#F5F0FF] mt-6"
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
