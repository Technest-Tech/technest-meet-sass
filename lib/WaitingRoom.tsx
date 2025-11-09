'use client';

import React, { useState, useEffect } from 'react';
import { Users, Clock, AlertCircle } from 'lucide-react';

interface WaitingRoomProps {
  roomName: string;
  participantName: string;
  onAdmitted: () => void;
  onRejected: () => void;
}

export function WaitingRoom({ roomName, participantName, onAdmitted, onRejected }: WaitingRoomProps) {
  const [status, setStatus] = useState<'waiting' | 'checking'>('waiting');
  const [waitTime, setWaitTime] = useState(0);
  const [waitingParticipantId, setWaitingParticipantId] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);

  // Join waiting room on mount
  useEffect(() => {
    const joinWaitingRoom = async () => {
      try {
        console.log('🚪 Joining waiting room:', { roomName, participantName });
        
        const response = await fetch('/api/room/waiting-room/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            participantName,
            participantType: 'GUEST'
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Joined waiting room:', data);
          
          if (data.waitingParticipant) {
            setWaitingParticipantId(data.waitingParticipant.id);
          }
          setIsJoined(true);
        } else {
          console.error('❌ Failed to join waiting room');
          const error = await response.json();
          console.error('Error details:', error);
        }
      } catch (error) {
        console.error('Error joining waiting room:', error);
      }
    };

    joinWaitingRoom();
  }, [roomName, participantName]);

  // Poll waiting room status (only after joined)
  useEffect(() => {
    if (!isJoined) return;

    const checkStatus = async () => {
      try {
        const response = await fetch(
          `/api/room/waiting-room/check?roomName=${encodeURIComponent(roomName)}&participantName=${encodeURIComponent(participantName)}`
        );
        
        if (response.ok) {
          const data = await response.json();
          console.log('📊 Waiting room status:', data);
          
          if (data.inWaitingRoom && data.status === 'admitted') {
            console.log('✅ Admitted to meeting!');
            onAdmitted();
          } else if (data.inWaitingRoom && data.status === 'rejected') {
            console.log('❌ Rejected from meeting');
            onRejected();
          }
        }
      } catch (error) {
        console.error('Error checking waiting room status:', error);
      }
    };

    // Check immediately
    checkStatus();

    // Then check every 2 seconds
    const interval = setInterval(checkStatus, 2000);

    return () => clearInterval(interval);
  }, [isJoined, roomName, participantName, onAdmitted, onRejected]);

  // Update wait time
  useEffect(() => {
    const interval = setInterval(() => {
      setWaitTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatWaitTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated background */}
      <div style={{
        position: 'absolute',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        animation: 'drift 20s linear infinite',
        top: '-50%',
        left: '-50%'
      }}></div>

      <div style={{
        textAlign: 'center',
        zIndex: 10,
        position: 'relative',
        padding: '48px',
        borderRadius: '20px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        maxWidth: '500px',
        width: '100%'
      }}>
        {/* Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          margin: '0 auto 24px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          <Users size={40} color="white" />
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#1f2937',
          marginBottom: '12px',
          lineHeight: '1.2'
        }}>
          Waiting for Host Approval
        </h1>

        {/* Description */}
        <p style={{
          fontSize: '16px',
          color: '#6b7280',
          marginBottom: '32px',
          lineHeight: '1.5'
        }}>
          The host will admit you to the meeting shortly. Please wait while your request is being reviewed.
        </p>

        {/* Wait time indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '16px',
          background: '#f3f4f6',
          borderRadius: '12px',
          marginBottom: '24px'
        }}>
          <Clock size={20} color="#667eea" />
          <span style={{
            fontSize: '15px',
            fontWeight: '500',
            color: '#4b5563'
          }}>
            Waiting time: {formatWaitTime(waitTime)}
          </span>
        </div>

        {/* Meeting info */}
        <div style={{
          padding: '20px',
          background: '#fef3c7',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '1px solid #fcd34d'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <AlertCircle size={20} color="#f59e0b" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div style={{ textAlign: 'left' }}>
              <p style={{
                fontSize: '14px',
                color: '#92400e',
                margin: 0,
                lineHeight: '1.5'
              }}>
                <strong>Room:</strong> {roomName}<br />
                <strong>Your name:</strong> {participantName}<br />
                <strong>Status:</strong> Waiting for approval
              </p>
            </div>
          </div>
        </div>

        {/* Loading animation */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginTop: '20px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#667eea',
            animation: 'bounce 1.4s ease-in-out infinite',
            animationDelay: '0s'
          }}></div>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#667eea',
            animation: 'bounce 1.4s ease-in-out infinite',
            animationDelay: '0.2s'
          }}></div>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#667eea',
            animation: 'bounce 1.4s ease-in-out infinite',
            animationDelay: '0.4s'
          }}></div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
        }
        @keyframes drift {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
      `}</style>
    </div>
  );
}

