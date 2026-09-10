import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import '../styles/globals.css';
import { useAuth } from '../hooks/useAuth';

const PUBLIC_ROUTES = ['/login'];

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { session, loading } = useAuth();
  const isPublicRoute = PUBLIC_ROUTES.includes(router.pathname);

  useEffect(() => {
    if (loading) return;
    if (!session && !isPublicRoute) router.push('/login');
    if (session && router.pathname === '/login') router.push('/');
  }, [loading, session, isPublicRoute, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08091C] text-[#F5F0FF] flex items-center justify-center">
        <p className="font-mono text-sm tracking-wide text-[#9CA3D9]">Loading…</p>
      </div>
    );
  }

  if (!session && !isPublicRoute) return null;

  return <Component {...pageProps} />;
}
