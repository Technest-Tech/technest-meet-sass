import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import { Almarai } from 'next/font/google';
import { GlobalErrorHandler } from '@/lib/components/GlobalErrorHandler';

const almarai = Almarai({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '700', '800'],
  variable: '--font-almarai',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Academic-meet | Video Conferencing',
    template: '%s',
  },
  description:
    'Academic-meet provides secure video conferencing for educational and business meetings. Access your meetings using room links provided by your administrator.',
  twitter: {
    creator: '@academicmeet',
    site: '@academicmeet',
    card: 'summary_large_image',
  },
  openGraph: {
    url: 'https://academic-meet.com',
    images: [
      {
        url: 'https://academic-meet.com/images/academic-meet-open-graph.png',
        width: 2000,
        height: 1000,
        type: 'image/png',
      },
    ],
    siteName: 'Academic-meet',
  },
  icons: {
    icon: {
      rel: 'icon',
      url: '/academiq-meet-logo.png',
    },
    apple: [
      {
        rel: 'apple-touch-icon',
        url: '/academiq-meet-logo.png',
        sizes: '180x180',
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#0f4c75',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={almarai.variable}>
      <body 
        data-lk-theme="default" 
        className={almarai.className}
        suppressHydrationWarning
      >
        <GlobalErrorHandler>
          <Toaster 
            position="top-left"
            toastOptions={{
              style: {
                zIndex: 9999999,
              },
            }}
            containerStyle={{
              zIndex: 9999999,
            }}
            // Make toasts dismissible by clicking on them
            // Click outside functionality is handled in individual toast calls
          />
          {children}
        </GlobalErrorHandler>
      </body>
    </html>
  );
}
