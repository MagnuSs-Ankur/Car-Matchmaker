import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'Car Matchmaker',
  description: 'Find the perfect car using AI',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <nav className="nav">
            <Link href="/" style={{ fontSize: '1.5rem' }}>🚗 Matchmaker</Link>
            <Link href="/shortlist">My Shortlist</Link>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
