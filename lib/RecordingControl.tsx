'use client';

import React from 'react';
import { SimpleRecordingControl } from './SimpleRecordingControl';

interface RecordingControlProps {
  isHost: boolean;
  canRecord?: boolean;
}

export function RecordingControl({ isHost, canRecord }: RecordingControlProps) {
  // Don't show recording controls if recording is not allowed for this room
  if (!canRecord) {
    return null;
  }
  
  // Always use simple recording control
  return <SimpleRecordingControl isHost={isHost} />;
}