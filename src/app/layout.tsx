import './globals.css';
import { AuthProvider } from '../context/AuthContext';

export const metadata = {
  title: 'Electric Cooperative Dashboard',
  description: 'System loss, power supply, billing, membership, and outage reporting.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
