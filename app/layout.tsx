import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: {
    default: 'Almajd Academy | Video Conferencing',
    template: '%s',
  },
  description:
    'Almajd Academy provides secure video conferencing for educational and business meetings. Access your meetings using room links provided by your administrator.',
  twitter: {
    creator: '@almajdacademy',
    site: '@almajdacademy',
    card: 'summary_large_image',
  },
  openGraph: {
    url: 'https://almajdacademy.com',
    images: [
      {
        url: 'https://almajdacademy.com/images/almajd-open-graph.png',
        width: 2000,
        height: 1000,
        type: 'image/png',
      },
    ],
    siteName: 'Almajd Academy',
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
  themeColor: '#667eea',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-lk-theme="default">
        <Toaster />
        {children}
      </body>
    </html>
  );
}
