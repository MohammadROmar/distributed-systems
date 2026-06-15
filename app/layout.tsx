import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = { title: 'Distributed Systems' };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className="h-full max-w-[100vw] overflow-x-hidden antialiased"
    >
      <body className="min-h-full overflow-x-hidden">{children}</body>
    </html>
  );
}
