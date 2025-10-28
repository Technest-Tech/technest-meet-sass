'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { PageClientImpl } from '@/app/rooms/[roomName]/PageClientImpl';
import { NameInputPage } from '@/lib/NameInputPage';

interface RoomValidation {
  exists: boolean;
  room?: {
    id: string;
    name: string;
    isActive: boolean;
    hostApproval: boolean;
    canRecord: boolean;
  };
}

export default function HostRoomAccess() {
  const params = useParams();
  
  const roomLink = params.roomLink as string;
  const accessType = 'host';
  const [roomValidation, setRoomValidation] = useState<RoomValidation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [showNameInput, setShowNameInput] = useState(false);

  // Debug logging
  console.log('🔍 Host Room Access Debug:', {
    roomLink,
    accessType
  });

  // Validate room exists in admin database
  useEffect(() => {
    const validateRoom = async () => {
      if (!roomLink) {
        setError('Invalid room access parameters');
        setIsLoading(false);
        return;
      }

      try {
        // Check if room exists in admin database
        const response = await fetch(`/api/room/validate/${roomLink}?type=${accessType}`);
        
        if (response.ok) {
          const data = await response.json();
          setRoomValidation(data);
          setShowNameInput(true); // Show name input after successful validation
        } else {
          const errorData = await response.json();
          setError(errorData.message || 'Room not found or access denied');
        }
      } catch (error) {
        setError('Failed to validate room access');
      } finally {
        setIsLoading(false);
      }
    };

    validateRoom();
  }, [roomLink, accessType]);

  // Validate the room link
  if (!roomLink) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Room Access</h1>
          <p className="text-gray-600 mb-4">
            Please ensure you are using a complete room link with the correct access type (e.g., /h for host or /g for guest).
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Go Back
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
        accessType={accessType as 'host' | 'guest'}
        roomName={roomValidation?.room?.name}
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validating room access...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !roomValidation?.exists) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            {error || 'This room does not exist or has not been created through the admin panel.'}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Only rooms created through the admin panel can access meetings.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Check if room is active
  if (!roomValidation.room?.isActive) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Room Inactive</h1>
          <p className="text-gray-600 mb-4">
            This room is currently inactive and cannot be accessed.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Please contact the administrator to activate this room.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Generate a meaningful participant name based on access type
  const participantName = userName || 'Host';
  
  // Both host and guest join the SAME meeting room
  // Host gets admin permissions, guest gets basic permissions
  const roomName = roomLink; // Same room for both
  
  // Log the integration details for debugging
  console.log('🔗 Host Room Integration:', {
    originalRoomLink: roomLink,
    accessType,
    participantName,
    actualRoomName: roomName,
    workingSystemPath: `/rooms/${roomName}?name=${participantName}`,
    message: 'Host joins meeting with admin permissions',
    roomValidation: roomValidation
  });

  // Use the working system's PageClientImpl with the converted parameters
  // This ensures we get exactly the same functionality as the working system
  // Now with auto-connect (no pre-join page) and same room for both
  return (
    <PageClientImpl
      roomName={roomName}
      region={undefined}
      hq={false}
      codec="vp8"
      userName={participantName}
      participantType={accessType as 'host' | 'guest'}
      canRecord={roomValidation.room?.canRecord || false}
    />
  );
}
