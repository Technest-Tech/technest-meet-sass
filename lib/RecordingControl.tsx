'use client';

import React from 'react';
import { SimpleRecordingControl } from './SimpleRecordingControl';

interface RecordingControlProps {
  isHost: boolean;
  canRecord?: boolean;
}

export function RecordingControl({ isHost, canRecord }: RecordingControlProps) {
  const featureEnabled = Boolean(canRecord);

  // Always use simple recording control but reflect feature availability
  return (
    <SimpleRecordingControl
      isHost={isHost}
      isFeatureEnabled={featureEnabled}
      showProBadge={!featureEnabled}
    />
  );
}