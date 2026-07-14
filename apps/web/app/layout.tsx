import { AuthSessionProvider } from '@/components/auth-session-provider';
import { PrelineBoot } from '@/components/preline-boot';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeScript } from '@/components/theme-script';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
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
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <AuthSessionProvider>
          <ThemeProvider>
            {children}
            <PrelineBoot />
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
