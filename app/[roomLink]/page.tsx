'use client';

import { useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { logger } from '@/lib/utils/logger';

export default function LegacyRoomAccess() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  useEffect(() => {
    const roomLink = params.roomLink as string;
    const isHost = searchParams.get('h') !== null;
    const isGuest = searchParams.get('g') !== null;
    
    logger.debug('Legacy room access redirect:', { roomLink, isHost, isGuest });
    
    if (isHost) {
      logger.info('Redirecting legacy host link to new format');
      router.replace(`/${roomLink}/h`);
    } else if (isGuest) {
      logger.info('Redirecting legacy guest link to new format');
      router.replace(`/${roomLink}/g`);
    } else {
      logger.warn('Invalid legacy room link format, redirecting to home');
      router.replace('/');
    }
  }, [params.roomLink, searchParams, router]);
  
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        borderRadius: '20px',
        background: 'rgba(0, 0, 0, 0.2)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          margin: '0 auto 20px',
          border: '3px solid rgba(255, 255, 255, 0.3)',
          borderTop: '3px solid #ffffff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        
        <h2 style={{
          fontSize: '24px',
          fontWeight: '600',
          marginBottom: '8px'
        }}>
          Redirecting...
        </h2>
        <p style={{
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: '14px'
        }}>
          Please wait while we redirect you to the meeting
        </p>
      </div>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
