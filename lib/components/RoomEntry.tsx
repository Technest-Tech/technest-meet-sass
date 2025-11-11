'use client';

import React, { useState, useEffect } from 'react';
import { PageClientImpl } from '@/app/rooms/[roomName]/PageClientImpl';
import { NameInputPage } from '@/lib/NameInputPage';
import { WaitingRoom } from '@/lib/WaitingRoom';
import { logger } from '@/lib/utils/logger';
import { useConnectionStore } from '@/lib/store';
import { ErrorBoundary } from '@/lib/components/ErrorBoundary';

interface RoomValidation {
  exists: boolean;
  room?: {
    id: string;
    name: string;
    isActive: boolean;
    hostApproval: boolean;
    canRecord: boolean;
    requireWaitingRoom: boolean;
    allowGuestUnmute: boolean;
    enablePrivateChat: boolean;
  };
  client?: {
    name: string;
    email: string;
  };
}

interface RoomEntryProps {
  roomLink: string;
  accessType: 'host' | 'guest';
}

export function RoomEntry({ roomLink, accessType }: RoomEntryProps) {
  const [roomValidation, setRoomValidation] = useState<RoomValidation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [showNameInput, setShowNameInput] = useState(false);
  const [requiresWaiting, setRequiresWaiting] = useState(false);
  
  // Reset connection store on mount
  const resetConnectionStore = useConnectionStore(state => state.reset);
  
  useEffect(() => {
    resetConnectionStore();
  }, [resetConnectionStore]);

  // Debug logging
  logger.debug(`${accessType} Room Access:`, {
    roomLink,
    accessType
  });

  // Validate room exists in admin database
  useEffect(() => {
    const validateRoom = async () => {
      if (!roomLink) {
        setError('معاملات الوصول للغرفة غير صحيحة');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/room/validate/${roomLink}?type=${accessType}`, {
          cache: 'no-store', // Force fresh data, no caching
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 Room validation data:', data);
          console.log('🎯 Room features:', data.room);
          setRoomValidation(data);
          
          // Check if waiting room is required for guests
          if (data.room?.requireWaitingRoom && accessType === 'guest') {
            setRequiresWaiting(true);
          }
          
          setShowNameInput(true);
        } else {
          const errorData = await response.json();
          setError(errorData.message || 'الغرفة غير موجودة أو تم حذفها');
        }
      } catch (error) {
        logger.error('Failed to validate room access:', error);
        setError('فشل التحقق من الوصول للغرفة');
      } finally {
        setIsLoading(false);
      }
    };

    validateRoom();
  }, [roomLink, accessType]);

  // Validate the room link
  if (!roomLink) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-lg w-full text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-red-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">رابط غير صحيح</h1>
          <p className="text-lg text-gray-700 mb-8">
            يرجى التأكد من استخدام رابط كامل مع نوع الوصول الصحيح.
          </p>
          <button
            onClick={() => window.history.back()}
            className="w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl hover:from-primary-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            العودة للخلف
          </button>
        </div>
      </div>
    );
  }

  // Show name input page
  if (showNameInput && !userName) {
    return (
      <NameInputPage
        roomLink={roomLink}
        accessType={accessType}
        roomName={roomValidation?.room?.name}
        clientName={roomValidation?.client?.name}
        onNameSubmit={(name) => {
          setUserName(name);
          setShowNameInput(false);
        }}
      />
    );
  }

  // Show loading state
  if (isLoading || !roomValidation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4" dir="rtl">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-primary-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-primary-600 rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-2 border-4 border-indigo-200 rounded-full"></div>
            <div className="absolute inset-2 border-4 border-indigo-600 rounded-full border-r-transparent animate-spin [animation-direction:reverse] [animation-duration:1.5s]"></div>
          </div>
          <p className="text-lg font-medium text-gray-700 mb-2">جاري التحقق من الوصول...</p>
          <p className="text-sm text-gray-500">يرجى الانتظار</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !roomValidation?.exists) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-lg w-full text-center">
          <div className="relative mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-red-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <svg className="w-12 h-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full animate-ping"></div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">الرابط غير صحيح</h1>
          <p className="text-lg text-gray-700 mb-2">
            {error || 'الغرفة غير موجودة أو تم حذفها'}
          </p>
          <p className="text-sm text-gray-600 mb-8 leading-relaxed">
            يبدو أن الرابط الذي تحاول الوصول إليه غير صحيح أو أن الغرفة قد تم حذفها. يرجى التحقق من الرابط والتأكد من صحته.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.history.back()}
              className="w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl hover:from-primary-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              العودة للخلف
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-medium"
            >
              الصفحة الرئيسية
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if room is active
  if (!roomValidation.room?.isActive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-lg w-full text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">الغرفة غير نشطة</h1>
          <p className="text-lg text-gray-700 mb-2">
            هذه الغرفة غير نشطة حالياً ولا يمكن الوصول إليها.
          </p>
          <p className="text-sm text-gray-600 mb-8 leading-relaxed">
            يرجى التواصل مع المسؤول لتفعيل هذه الغرفة.
          </p>
          <button
            onClick={() => window.history.back()}
            className="w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl hover:from-primary-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            العودة للخلف
          </button>
        </div>
      </div>
    );
  }

  // Generate participant name
  const participantName = userName || (accessType === 'host' ? 'مضيف' : 'ضيف');
  const roomName = roomLink;
  
  // Log the integration details
  logger.debug(`${accessType} Room Integration:`, {
    originalRoomLink: roomLink,
    accessType,
    participantName,
    actualRoomName: roomName,
    roomValidation: roomValidation
  });

  // If waiting room is required and guest hasn't been admitted yet, show waiting room
  if (roomValidation.room?.requireWaitingRoom && requiresWaiting && accessType === 'guest' && userName) {
    return (
      <WaitingRoom
        roomName={roomLink}
        participantName={userName}
        onAdmitted={() => {
          logger.success('Guest admitted to meeting');
          setRequiresWaiting(false);
        }}
        onRejected={() => {
          logger.warn('Guest rejected from meeting');
          setError('تم رفض طلبك للانضمام من قبل المضيف');
          setRequiresWaiting(false);
        }}
      />
    );
  }

  // Render the main meeting component
  return (
    <ErrorBoundary>
      <PageClientImpl
        roomName={roomName}
        region={undefined}
        hq={false}
        codec="vp8"
        userName={participantName}
        participantType={accessType}
        canRecord={roomValidation.room?.canRecord || false}
        requireWaitingRoom={roomValidation.room?.requireWaitingRoom || false}
        allowGuestUnmute={roomValidation.room?.allowGuestUnmute ?? true}
        enablePrivateChat={roomValidation.room?.enablePrivateChat ?? true}
        roomFeatures={roomValidation.room} // Pass all room feature flags
      />
    </ErrorBoundary>
  );
}

