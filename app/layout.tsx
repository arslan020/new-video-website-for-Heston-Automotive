import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/ToastProvider';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Heston Automotive – Video Portal',
  description: 'Car video management portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
