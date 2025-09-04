import React from 'react';
import { TrackToggle } from '@livekit/components-react';
import { MediaDeviceMenu } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { isLowPowerDevice } from './client-utils';

export function MicrophoneSettings() {
  // Note: Krisp noise filter is not available in this version
  const isNoiseFilterEnabled = false;
  const setNoiseFilterEnabled = () => {};
  const isNoiseFilterPending = false;

  React.useEffect(() => {
    // Note: Krisp noise filter is not available in this version
    // setNoiseFilterEnabled(!isLowPowerDevice());
  }, []);
  return (
    <div
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

      <button
        className="lk-button"
        onClick={() => {/* Noise filter not available */}}
        disabled={isNoiseFilterPending}
        aria-pressed={isNoiseFilterEnabled}
      >
        {isNoiseFilterEnabled ? 'Disable' : 'Enable'} Enhanced Noise Cancellation
      </button>
    </div>
  );
}
