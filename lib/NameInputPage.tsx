'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface NameInputPageProps {
  roomLink: string;
  accessType: 'host' | 'guest';
  roomName?: string;
  clientName?: string;
  passwordRequired?: boolean;
  passwordFor?: 'HOST_ONLY' | 'HOST_AND_GUEST' | null;
  onNameSubmit: (name: string) => void;
}

export function NameInputPage({ roomLink, accessType, roomName, clientName, passwordRequired, passwordFor, onNameSubmit }: NameInputPageProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const router = useRouter();

  // Check if password is required for this access type
  const requiresPassword = passwordRequired && (
    passwordFor === 'HOST_AND_GUEST' ||
    (passwordFor === 'HOST_ONLY' && accessType === 'host')
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // If password is required, verify it first
    if (requiresPassword) {
      if (!password.trim()) {
        setPasswordError('Password is required');
        return;
      }

      setIsSubmitting(true);
      setPasswordError(null);

      try {
        const response = await fetch('/api/room/verify-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomLink,
            accessType,
            password,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          setPasswordError(data.error || 'Invalid password');
          setIsSubmitting(false);
          return;
        }

        // Password verified, proceed with name submission
        onNameSubmit(name.trim());
        setIsSubmitting(false);
      } catch (error) {
        setPasswordError('Failed to verify password. Please try again.');
        setIsSubmitting(false);
      }
    } else {
      // No password required, proceed normally
      setIsSubmitting(true);
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onNameSubmit(name.trim());
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    router.back();
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
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-300">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            </div>
            {/* Badge for access type */}
            <div className={`absolute -top-2 -right-2 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-md ${
              accessType === 'host' 
                ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' 
                : 'bg-gradient-to-r from-blue-400 to-indigo-500 text-white'
            }`}>
              {accessType === 'host' ? '👑 Host' : '👤 Guest'}
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Join Meeting
          </h1>

          {/* Description */}
          <p className="text-gray-600 text-base mb-4 leading-relaxed">
            Enter your name to join the video conference
          </p>

          {/* Information Cards */}
          <div className="space-y-1.5 mb-4">
          {clientName && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg px-4 py-2 border border-blue-100">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Academy:</span>
                  <span className="text-sm font-bold text-blue-700">{clientName}</span>
                </div>
            </div>
          )}
            
          {roomName && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg px-4 py-2 border border-indigo-100">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Room Name:</span>
                  <span className="text-sm font-bold text-indigo-700">{roomName}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2 text-left">
              Your Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base text-left placeholder-gray-400 shadow-sm hover:shadow-md"
              required
              maxLength={50}
              disabled={isSubmitting}
                autoFocus
            />
            </div>
            <p className="mt-1.5 text-xs text-gray-500 text-left">
              This name will be visible to other participants
            </p>
          </div>

          {/* Password Field */}
          {requiresPassword && (
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2 text-left">
                Room Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError(null);
                  }}
                  placeholder="Enter room password"
                  className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base text-left placeholder-gray-400 shadow-sm hover:shadow-md ${
                    passwordError ? 'border-red-500' : 'border-gray-200'
                  }`}
                  required
                  disabled={isSubmitting}
                  autoFocus={requiresPassword}
                />
              </div>
              {passwordError && (
                <p className="mt-1.5 text-xs text-red-600 text-left">{passwordError}</p>
              )}
              <p className="mt-1.5 text-xs text-gray-500 text-left">
                This room requires a password to join
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 px-5 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              disabled={isSubmitting}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
            <button
              type="submit"
              disabled={!name.trim() || (requiresPassword && !password.trim()) || isSubmitting}
              className="flex-1 px-5 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 disabled:from-gray-300 disabled:via-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
            >
              {isSubmitting ? (
                <>
                  <div className="relative w-4 h-4">
                    <div className="absolute inset-0 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <span>Joining...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span>Join Meeting</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-gray-200">
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
