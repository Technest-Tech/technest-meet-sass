'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@/lib/utils/logger';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('React Error Boundary caught error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      
      return <ErrorFallback error={this.state.error} reset={this.reset} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
}

function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f3f4f6',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '32px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        {/* Error Icon */}
        <div style={{
          width: '64px',
          height: '64px',
          backgroundColor: '#fee2e2',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px'
        }}>
          <svg
            style={{ width: '32px', height: '32px', color: '#dc2626' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        {/* Error Title */}
        <h1 style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#111827',
          marginBottom: '12px'
        }}>
          Something went wrong
        </h1>

        {/* Error Message */}
        <p style={{
          fontSize: '16px',
          color: '#6b7280',
          marginBottom: '8px',
          lineHeight: '1.6'
        }}>
          We encountered an unexpected error. Don&apos;t worry, your data is safe.
        </p>

        {/* Technical Error (collapsible in production) */}
        {process.env.NODE_ENV === 'development' && (
          <details style={{
            marginTop: '16px',
            marginBottom: '24px',
            textAlign: 'left'
          }}>
            <summary style={{
              cursor: 'pointer',
              fontSize: '14px',
              color: '#6b7280',
              marginBottom: '8px'
            }}>
              Technical Details
            </summary>
            <pre style={{
              backgroundColor: '#f9fafb',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#374151',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          marginTop: '24px'
        }}>
          <button
            onClick={reset}
            style={{
              padding: '12px 24px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1d4ed8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
            }}
          >
            Try Again
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '12px 24px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
          >
            Go Home
          </button>
        </div>

        {/* Help Text */}
        <p style={{
          fontSize: '14px',
          color: '#9ca3af',
          marginTop: '24px'
        }}>
          If this problem persists, please contact support
        </p>
      </div>
    </div>
  );
}


















