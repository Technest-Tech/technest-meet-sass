import { PageClientImpl } from '@/app/rooms/[roomName]/PageClientImpl';
import { VideoCodec } from 'livekit-client';

interface ObserverPageProps {
  params: Promise<{
    roomLink: string;
  }>;
  searchParams: Promise<{
    codec?: string;
    hq?: string;
    e2ee?: string;
  }>;
}

export default async function ObserverPage({ params, searchParams }: ObserverPageProps) {
  const { roomLink } = await params;
  const resolvedSearchParams = await searchParams;
  const codec = (resolvedSearchParams.codec as VideoCodec) || 'vp8';
  const hq = resolvedSearchParams.hq === 'true';

  // Observer always joins with a generic name
  const observerName = 'Observer';

  return (
    <main style={{ height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: '#000' }}>
      <PageClientImpl
        roomName={roomLink}
        userName={observerName}
        codec={codec}
        hq={hq}
        participantType="observer"
        canRecord={false}
        requireWaitingRoom={false}
        allowGuestUnmute={false}
        enablePrivateChat={false}
        roomFeatures={{
          enablePrivateChat: false,
          enableReactions: false,
          enableRaiseHand: false,
          enableFileSharing: false,
          enableScreenAnnotation: false,
          enablePdfViewer: false,
          enableStudentMonitorPiP: false,
          enableCollaborativeWhiteboard: false,
          enableNormalWhiteboard: false,
          enableManageParticipants: false,
          enableVirtualBackground: false,
        }}
      />
    </main>
  );
}

// Generate metadata for the page
export async function generateMetadata({ params }: ObserverPageProps) {
  const { roomLink } = await params;
  return {
    title: 'Observer Mode - Meeting',
    description: 'Silent observer mode for meeting monitoring',
    robots: 'noindex, nofollow', // Don't index observer pages
  };
}

