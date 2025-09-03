'use client';

import React, { useEffect, useState } from 'react';
import styles from '../styles/Whiteboard.module.css';

interface WhiteboardNotificationProps {
  message: string;
  type: 'info' | 'success' | 'warning';
  duration?: number;
  onClose: () => void;
}

export function WhiteboardNotification({ 
  message, 
  type, 
  duration = 3000, 
  onClose 
}: WhiteboardNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return styles.notificationSuccess;
      case 'warning':
        return styles.notificationWarning;
      default:
        return styles.notificationInfo;
    }
  };

  return (
    <div className={`${styles.notification} ${getTypeStyles()} ${isVisible ? styles.notificationVisible : ''}`}>
      <div className={styles.notificationContent}>
        <span className={styles.notificationMessage}>{message}</span>
        <button 
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className={styles.notificationClose}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
