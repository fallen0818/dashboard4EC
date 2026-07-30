import Link from 'next/link';

const MODULES = [
  { href: '/system-loss', label: 'System Loss' },
  { href: '/power-supply', label: 'Power Supply' },
  { href: '/billing', label: 'Billing & Collections' },
  { href: '/membership', label: 'Membership' },
  { href: '/outages', label: 'Outages' },
];

export default function HomePage() {
  return (
    <div style={{ padding: 40, maxWidth: 600, margin: '0 auto' }}>
      <h1>Electric Cooperative Dashboard</h1>
      <div className="sld-divider"><span className="sld-node" /></div>
      <div className="card">
        {MODULES.map((m) => (
          <div key={m.href} style={{ padding: '8px 0' }}>
            <Link href={m.href}>{m.label}</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
