import type { Metadata } from 'next';
import './globals.css';
import { funnelSans } from '../styles/fonts';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: 'noindex, nofollow, nosnippet, noarchive, nocache',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${funnelSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
