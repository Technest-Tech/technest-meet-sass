'use client';

import React from 'react';
import { SimpleRecordingControl } from './SimpleRecordingControl';

interface RecordingControlProps {
  isHost: boolean;
}

export function RecordingControl({ isHost }: RecordingControlProps) {
  // Always use simple recording control
  return <SimpleRecordingControl isHost={isHost} />;
}