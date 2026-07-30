'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthContext } from '../../context/AuthContext';
import { supabase } from '../../services/supabase/client';

const MODULES = [
  { href: '/system-loss', label: 'System Loss' },
  { href: '/power-supply', label: 'Power Supply' },
  { href: '/billing', label: 'Billing & Collections' },
  { href: '/membership', label: 'Membership' },
  { href: '/outages', label: 'Outages' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuthContext();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) return <div style={{ padding: 32 }}>Checking session...</div>;
  if (!user) return <div style={{ padding: 32 }}>Redirecting to login...</div>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-title">PANELCO I &middot; Dashboard</div>
        <nav>
          {MODULES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`sidebar-link${pathname === m.href ? ' active' : ''}`}
            >
              {m.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="topbar">
          <span className="topbar-email">{user.email}</span>
          <button className="secondary" onClick={handleSignOut}>Sign out</button>
        </div>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
