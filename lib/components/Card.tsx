'use client';

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export default function Card({ 
  children, 
  className = '', 
  hover = false,
  padding = 'md' 
}: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={`
        bg-white rounded-xl shadow-soft border border-gray-100
        ${paddingClasses[padding]}
        ${hover ? 'hover:shadow-medium hover:scale-[1.01] transition-all duration-300' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

