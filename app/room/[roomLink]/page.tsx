'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { PageClientImpl } from '@/app/rooms/[roomName]/PageClientImpl';
import { NameInputPage } from '@/lib/NameInputPage';

interface RoomValidation {
  exists: boolean;
  message?: string;
  errorType?: string;
  room?: {
    id: string;
    name: string;
    isActive: boolean;
    hostApproval: boolean;
  };
}

export default function DirectRoomAccess() {
  const params = useParams();
  const searchParams = useSearchParams();
  
  const roomLink = params.roomLink as string;
  const accessType = searchParams.get('type');
  const [roomValidation, setRoomValidation] = useState<RoomValidation | null>(null);
  const [roomFeatures, setRoomFeatures] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [showNameInput, setShowNameInput] = useState(false);

  // Validate room exists in admin database
  useEffect(() => {
    const validateRoom = async () => {
      if (!roomLink || !accessType) {
        setError('Invalid room access parameters');
        setIsLoading(false);
        return;
      }

      try {
        // Check if room exists in admin database
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
          setRoomFeatures(data.room); // Store all room feature flags
          setShowNameInput(true); // Show name input after successful validation
        } else {
          const errorData = await response.json();
          setError(errorData.message || 'Room not found or access denied');
          setRoomValidation({
            exists: false,
            message: errorData.message,
            errorType: errorData.errorType,
          });
        }
      } catch (error) {
        setError('Failed to validate room access');
      } finally {
        setIsLoading(false);
      }
    };

    validateRoom();
  }, [roomLink, accessType]);

  // Validate the room link and access type
  if (!roomLink || !accessType) {
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
            Please ensure you are using a complete room link with the correct access type (e.g., ?type=host or ?type=guest).
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

  // Validate access type
  if (accessType !== 'host' && accessType !== 'guest') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.732 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Access Type</h1>
          <p className="text-gray-600 mb-4">
            Access type must be either &apos;host&apos; or &apos;guest&apos;. You provided: {accessType}
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
        passwordRequired={roomValidation?.room?.passwordRequired}
        passwordFor={roomValidation?.room?.passwordFor}
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

  // Show error state with specific placeholder pages based on error type
  if (error || !roomValidation?.exists) {
    const errorType = roomValidation?.errorType || 'UNKNOWN';
    
    // Account-related errors
    if (errorType === 'ACCOUNT_INACTIVE' || errorType === 'ACCOUNT_NOT_FOUND' || errorType === 'ACCOUNT_SUSPENDED') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-lg w-full text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-red-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {errorType === 'ACCOUNT_SUSPENDED' ? 'Account Suspended' : 'Account Inactive'}
            </h1>
            <p className="text-lg text-gray-700 mb-2">
              {error || roomValidation?.message || 'Client account is not active'}
            </p>
            <p className="text-sm text-gray-600 mb-8 leading-relaxed">
              {errorType === 'ACCOUNT_SUSPENDED' 
                ? 'This account has been suspended by the administrator. Please contact support.'
                : 'The client account is currently inactive. Please contact the administrator to activate the account.'}
            </p>
            <button
              onClick={() => window.history.back()}
              className="w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl hover:from-primary-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }

    // Subscription-related errors
    if (errorType === 'NO_SUBSCRIPTION' || errorType === 'SUBSCRIPTION_INACTIVE' || errorType === 'SUBSCRIPTION_EXPIRED' || errorType === 'TRIAL_EXPIRED') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-lg w-full text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {errorType === 'TRIAL_EXPIRED' ? 'Trial Expired' : errorType === 'SUBSCRIPTION_EXPIRED' ? 'Subscription Expired' : 'Subscription Inactive'}
            </h1>
            <p className="text-lg text-gray-700 mb-2">
              {error || roomValidation?.message || 'Subscription is not active'}
            </p>
            <p className="text-sm text-gray-600 mb-8 leading-relaxed">
              {errorType === 'TRIAL_EXPIRED' 
                ? 'The trial period has expired. Please contact the administrator to upgrade to a paid plan.'
                : errorType === 'SUBSCRIPTION_EXPIRED'
                ? 'The subscription has expired. Please contact the administrator to renew the subscription.'
                : 'The subscription is currently inactive. Please contact the administrator to activate the subscription.'}
            </p>
            <button
              onClick={() => window.history.back()}
              className="w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl hover:from-primary-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }

    // Room not found error
    if (errorType === 'ROOM_NOT_FOUND') {
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
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Room Not Found</h1>
            <p className="text-lg text-gray-700 mb-2">
              {error || roomValidation?.message || 'The room does not exist or has been deleted'}
            </p>
            <p className="text-sm text-gray-600 mb-8 leading-relaxed">
              The link you are trying to access appears to be incorrect or the room has been deleted. Please verify the link and ensure it is correct.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.history.back()}
                className="w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl hover:from-primary-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Go Back
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-medium"
              >
                Home Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Default error placeholder
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-lg w-full text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-red-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Access Error</h1>
          <p className="text-lg text-gray-700 mb-2">
            {error || roomValidation?.message || 'An error occurred while trying to access the room'}
          </p>
          <p className="text-sm text-gray-600 mb-8 leading-relaxed">
            Please verify the link and ensure it is correct, or contact the administrator.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.history.back()}
              className="w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl hover:from-primary-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Go Back
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-medium"
            >
              Home Page
            </button>
          </div>
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
  const participantName = userName || (accessType === 'host' ? 'Host' : 'Guest');
  
  // Both host and guest join the SAME meeting room
  // Host gets admin permissions, guest gets basic permissions
  const roomName = roomLink; // Same room for both
  
  // Log the integration details for debugging
  console.log('🔗 Custom Room Integration:', {
    originalRoomLink: roomLink,
    accessType,
    participantName,
    actualRoomName: roomName,
    workingSystemPath: `/rooms/${roomName}?name=${participantName}`,
    message: 'Host and guest join SAME meeting with different permissions',
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
      roomFeatures={roomFeatures}
    />
  );
}
