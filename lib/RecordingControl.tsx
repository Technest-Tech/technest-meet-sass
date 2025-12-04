'use client';

import React from 'react';
import { SimpleRecordingControl } from './SimpleRecordingControl';

interface RecordingControlProps {
  isHost: boolean;
  canRecord?: boolean;
}

export function RecordingControl({ isHost, canRecord }: RecordingControlProps) {
  // Recording is now available for everyone, regardless of subscription
  return (
    <SimpleRecordingControl
      isHost={isHost}
      isFeatureEnabled={true}
      showProBadge={false}
    />
  );
}