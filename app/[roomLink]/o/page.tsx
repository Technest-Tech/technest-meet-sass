import { PageClientImpl } from '@/app/rooms/[roomName]/PageClientImpl';
import { VideoCodec } from 'livekit-client';

interface ObserverPageProps {
  params: {
    roomLink: string;
  };
  searchParams: {
    codec?: string;
    hq?: string;
    e2ee?: string;
  };
}

export default async function ObserverPage({ params, searchParams }: ObserverPageProps) {
  const { roomLink } = params;
  const codec = (searchParams.codec as VideoCodec) || 'vp8';
  const hq = searchParams.hq === 'true';

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
      
      {/* Observer Mode Indicator - Only visible to the observer */}
      <div style={{
        position: 'fixed',
        top: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        padding: '12px 24px',
        backgroundColor: 'rgba(220, 38, 38, 0.95)',
        color: 'white',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
        backdropFilter: 'blur(10px)',
        border: '2px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{ fontSize: '18px' }}>👁️</span>
        <span>Observer Mode - You are invisible to all participants</span>
      </div>
    </main>
  );
}

// Generate metadata for the page
export async function generateMetadata({ params }: ObserverPageProps) {
  return {
    title: 'Observer Mode - Meeting',
    description: 'Silent observer mode for meeting monitoring',
    robots: 'noindex, nofollow', // Don't index observer pages
  };
}

