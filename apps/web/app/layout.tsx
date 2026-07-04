import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { PrelineBoot } from '@/components/preline-boot';

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Paradis Immo',
  description: 'Plateforme immobilière hybride — Congo (CG)',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      data-bs-theme="dark"
      data-topbar-color="dark"
      data-sidebar-color="dark"
      className={`${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <PrelineBoot />
      </body>
    </html>
  );
}
