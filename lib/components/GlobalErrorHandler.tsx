'use client';

import React from 'react';
import { logger } from '@/lib/utils/logger';
import toast from 'react-hot-toast';

/**
 * GlobalErrorHandler component that catches unhandled promise rejections
 * and prevents page crashes/reloads from unhandled errors.
 * 
 * This component should be included in the root layout to catch all
 * unhandled promise rejections globally.
 */
export function GlobalErrorHandler({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      
      // Log the error for debugging
      logger.error('Unhandled promise rejection:', {
        error: errorMessage,
        name: errorName,
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      // Prevent default browser behavior (page reload)
      event.preventDefault();
      
      // Show user-friendly error message
      // Don't show toast for known/expected errors that are already handled elsewhere
      const isKnownError = 
        errorMessage.includes('Permission denied') ||
        errorMessage.includes('NotAllowedError') ||
        errorMessage.includes('User cancelled') ||
        errorMessage.includes('AbortError') ||
        (errorMessage.includes('NetworkError') && errorMessage.includes('Failed to fetch')) ||
        // Add Krisp CORS errors to known errors list (non-critical)
        (errorMessage.includes('Failed to fetch') && (
          errorMessage.includes('settings') || 
          errorMessage.includes('rtc') ||
          errorMessage.includes('acadmyq.com')
        )) ||
        errorMessage.includes('CORS') ||
        // Check if error is from Krisp SDK by examining stack trace
        (error instanceof TypeError && errorMessage.includes('Failed to fetch') && 
         (error.stack?.includes('krisp') || error.stack?.includes('Krisp') || error.stack?.includes('noise-filter')));
      
      if (!isKnownError) {
        toast.error('An unexpected error occurred. Please refresh if the issue persists.', {
          duration: 5000,
        });
      }
    };

    // Register the global error handler
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return <>{children}</>;
}

