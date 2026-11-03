import type { Metadata } from 'next';
import { ToastProvider } from '@/components/Toast';
import { ThemeProvider } from '@/components/ThemeProvider';
import { appPath } from '@/lib/paths';
import './globals.css';

export const metadata: Metadata = {
  title: 'SNS Textiles — Factory Management',
  description: 'Order, production, billing and delivery management for SNS Textiles',
  applicationName: 'SNS Textiles Factory Management',
  manifest: appPath('/manifest.webmanifest'),
  appleWebApp: { capable: true, title: 'SNS Textiles', statusBarStyle: 'default' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
      </body>
    </html>
  );
}
