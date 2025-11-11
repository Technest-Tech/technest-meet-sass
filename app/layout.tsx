import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import { Cairo } from 'next/font/google';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-cairo',
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
      url: '/favicon.ico',
    },
    apple: [
      {
        rel: 'apple-touch-icon',
        url: '/images/newmeet-apple-touch.png',
        sizes: '180x180',
      },
      { rel: 'mask-icon', url: '/images/newmeet-safari-pinned-tab.svg', color: '#667eea' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#0f4c75',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body data-lk-theme="default" className={cairo.className}>
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
        />
        {children}
      </body>
    </html>
  );
}
