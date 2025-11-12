'use client';

import React, { useState, useEffect } from 'react';

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4" dir="ltr">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6 md:p-8 w-full max-w-lg">
        {/* Header Section */}
        <div className="text-center mb-6">
        {/* Icon */}
          <div className="relative inline-block mb-4">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-300 animate-pulse">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            {/* Waiting badge */}
            <div className="absolute -top-2 -right-2 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-md bg-gradient-to-r from-amber-400 to-orange-500 text-white">
              ⏳ Waiting
            </div>
        </div>

        {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Waiting for Approval
        </h1>

        {/* Description */}
          <p className="text-gray-600 text-base mb-4 leading-relaxed">
          The host will admit you to the meeting shortly. Please wait while your request is being reviewed.
        </p>

          {/* Information Cards */}
          <div className="space-y-1.5 mb-5">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg px-4 py-2 border border-blue-100">
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm font-medium text-gray-600">Room Name:</span>
                <span className="text-sm font-bold text-blue-700">{roomName}</span>
              </div>
        </div>

            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg px-4 py-2 border border-indigo-100">
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm font-medium text-gray-600">Your Name:</span>
                <span className="text-sm font-bold text-indigo-700">{participantName}</span>
              </div>
            </div>
          </div>

          {/* Wait Time Indicator */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg px-4 py-2.5 border border-amber-100 mb-5">
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-gray-600">Waiting time:</span>
              <span className="text-sm font-bold text-amber-700">{formatWaitTime(waitTime)}</span>
            </div>
          </div>
        </div>

        {/* Status Section */}
        <div className="text-center">
        {/* Loading animation */}
          <div className="flex justify-center gap-2 mb-4">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>

          <p className="text-sm text-gray-500 font-medium">
            Checking for host approval...
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Secure</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>Private</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>HD Quality</span>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for blob animation */}
      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
        }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}

