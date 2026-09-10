import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';

// Sign-in only. Public sign-ups are disabled in Supabase Auth; new
// accounts are created by an admin via the Supabase dashboard, and their
// role is assigned in /users afterwards.
export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      router.push('/');
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
        <h1 className="text-2xl font-semibold tracking-tight text-center mb-8">Sign in</h1>

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

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#F5F0FF] text-[#08091C] font-medium py-2.5 rounded hover:bg-white transition-colors disabled:opacity-50"
          >
            {submitting ? 'Please wait…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center font-mono text-[11px] text-[#6C74A8]">
          New accounts are created by an admin. Ask them to invite you if you can&apos;t sign in.
        </p>
      </div>
    </div>
  );
}
