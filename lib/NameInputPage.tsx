'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface NameInputPageProps {
  roomLink: string;
  accessType: 'host' | 'guest';
  roomName?: string;
  clientName?: string;
  onNameSubmit: (name: string) => void;
}

export function NameInputPage({ roomLink, accessType, roomName, clientName, onNameSubmit }: NameInputPageProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onNameSubmit(name.trim());
    setIsSubmitting(false);
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Welcome to the Meeting
          </h1>
          {clientName && (
            <div className="mb-3">
              <p className="text-sm text-gray-500 mb-1">Organization:</p>
              <p className="text-lg font-semibold text-primary-600">{clientName}</p>
            </div>
          )}
          {roomName && (
            <p className="text-gray-600 mb-2">
              <span className="text-sm text-gray-500">Room:</span> {roomName}
            </p>
          )}
          <p className="text-sm text-gray-500 mt-2">
            Please enter your name to join as {accessType === 'host' ? 'Host' : 'Guest'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2 text-left" dir="ltr">
              Your Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 text-lg text-left"
              required
              maxLength={50}
              disabled={isSubmitting}
              dir="ltr"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors duration-200"
              disabled={isSubmitting}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {isSubmitting ? (
                <>
                  <div className="relative w-5 h-5 mr-2">
                    <div className="absolute inset-0 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  Joining...
                </>
              ) : (
                'Join Meeting'
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            By joining, you agree to our terms of service and privacy policy
          </p>
        </div>
      </div>
    </div>
  );
}
