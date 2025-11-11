'use client';

import { InputHTMLAttributes, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  floatingLabel?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export default function FormInput({
  label,
  error,
  helperText,
  floatingLabel = false,
  leftIcon,
  rightIcon,
  className = '',
  type = 'text',
  ...props
}: FormInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = props.value && String(props.value).length > 0;

  const inputType = type === 'password' && showPassword ? 'text' : type;

  return (
    <div className="w-full">
      {!floatingLabel && label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {leftIcon}
          </div>
        )}
        
        <input
          type={inputType}
          className={`
            w-full px-4 py-3 rounded-lg border bg-white text-gray-900 transition-all duration-200
            ${floatingLabel ? 'pt-5 pb-2' : ''}
            ${leftIcon ? 'pr-11' : ''}
            ${rightIcon || type === 'password' ? 'pl-11' : ''}
            ${error 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
            }
            focus:ring-2 focus:outline-none
            placeholder:text-gray-400
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            ${className}
          `}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        
        {floatingLabel && label && (
          <label
            className={`
              absolute right-4 transition-all duration-200 pointer-events-none
              ${isFocused || hasValue
                ? 'top-2 text-xs text-primary-600 font-medium'
                : 'top-1/2 -translate-y-1/2 text-sm text-gray-500'
              }
            `}
          >
            {label}
          </label>
        )}
        
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
        
        {rightIcon && type !== 'password' && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}

