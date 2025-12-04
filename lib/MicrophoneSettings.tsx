import React from 'react';
import { TrackToggle } from '@livekit/components-react';
import { MediaDeviceMenu } from '@livekit/components-react';
import { Track } from 'livekit-client';

interface MicrophoneSettingsProps {
  roomFeatures?: {
    enableNoiseCancellation?: boolean;
  };
}

export function MicrophoneSettings({ roomFeatures }: MicrophoneSettingsProps) {
  return (
    <div
      dir="ltr"
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '10px',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <section className="lk-button-group">
        <TrackToggle source={Track.Source.Microphone}>Microphone</TrackToggle>
        <div className="lk-button-group-menu">
          <MediaDeviceMenu kind="audioinput" />
        </div>
      </section>
    </div>
  );
}
