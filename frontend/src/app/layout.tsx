import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { AuthProvider } from '@/context/AuthContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import { NotificationProvider } from '@/context/NotificationContext';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'RentGoer | Find your place. Skip the broker.',
  description: 'The modern direct rental marketplace connecting tenants and property owners.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
        <AuthProvider>
          <NotificationProvider>
            <FavoritesProvider>
              <Navbar />
              <main className="flex-grow flex flex-col">
                {children}
              </main>
              <Footer />
            </FavoritesProvider>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
