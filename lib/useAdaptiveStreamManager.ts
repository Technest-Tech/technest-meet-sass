import * as React from 'react';
import {
  Room,
  RoomEvent,
  Track,
  VideoQuality,
  RemoteTrackPublication,
  RemoteTrack,
} from 'livekit-client';
import { ConnectionMonitor, QualityLevel } from './services/ConnectionMonitor';
import { NetworkAdapter } from './services/NetworkAdapter';
import { useMediaStore } from './store/mediaStore';
import { logger } from './utils/logger';

const qualityFromPreference = (pref: ReturnType<typeof useMediaStore>['videoQuality']) => {
  switch (pref) {
    case 'high':
      return VideoQuality.HIGH;
    case 'medium':
      return VideoQuality.MEDIUM;
    case 'low':
      return VideoQuality.LOW;
    default:
      return null;
  }
};

const qualityFromNetwork = (quality: QualityLevel): VideoQuality => {
  switch (quality) {
    case 'excellent':
      return VideoQuality.HIGH;
    case 'good':
      return VideoQuality.MEDIUM;
    case 'fair':
    case 'poor':
    default:
      return VideoQuality.LOW;
  }
};

export function useAdaptiveStreamManager(room: Room | null | undefined) {
  const preferredQuality = useMediaStore((state) => state.videoQuality);
  const adapterRef = React.useRef<NetworkAdapter>();
  const monitorRef = React.useRef<ConnectionMonitor>();
  const lastNetworkQuality = React.useRef<QualityLevel>('good');

  const determineTargetQuality = React.useCallback(
    (publication: RemoteTrackPublication, networkQuality: QualityLevel) => {
      if (publication.source === Track.Source.ScreenShare) {
        return VideoQuality.HIGH;
      }

      const manualChoice = preferredQuality !== 'auto' ? qualityFromPreference(preferredQuality) : null;
      if (manualChoice) {
        return manualChoice;
      }

      return qualityFromNetwork(networkQuality);
    },
    [preferredQuality],
  );

  const applyQualityToRemoteTracks = React.useCallback(
    (networkQuality: QualityLevel) => {
      if (!room) {
        return;
      }

      room.remoteParticipants.forEach((participant) => {
        participant.videoTrackPublications.forEach((publication) => {
          const target = determineTargetQuality(publication, networkQuality);
          if (!target) {
            return;
          }
          try {
            publication.setVideoQuality(target);
          } catch (error) {
            logger.warn('Failed to set remote track quality', {
              participant: participant.identity,
              trackSource: publication.source,
              error,
            });
          }
        });
      });
    },
    [room, determineTargetQuality],
  );

  React.useEffect(() => {
    if (!room) {
      return;
    }

    if (!adapterRef.current) {
      adapterRef.current = new NetworkAdapter();
    }
    adapterRef.current.setRoom(room);

    if (!monitorRef.current) {
      monitorRef.current = new ConnectionMonitor();
    }

    monitorRef.current.setCallbacks({
      onQualityChanged: (quality) => {
        lastNetworkQuality.current = quality;
        adapterRef.current?.adaptToNetworkConditions(quality);
        applyQualityToRemoteTracks(quality);
      },
      onPoorConnection: () => {
        applyQualityToRemoteTracks('poor');
      },
    });

    monitorRef.current.startMonitoring(room);
    applyQualityToRemoteTracks(lastNetworkQuality.current);

    return () => {
      monitorRef.current?.stopMonitoring();
    };
  }, [room, applyQualityToRemoteTracks]);

  React.useEffect(() => {
    if (!room) {
      return;
    }

    const handleTrackSubscribed = (
      _track: RemoteTrack,
      publication: RemoteTrackPublication,
    ) => {
      const target = determineTargetQuality(publication, lastNetworkQuality.current);
      if (!target) {
        return;
      }
      try {
        publication.setVideoQuality(target);
      } catch (error) {
        logger.warn('Failed to set subscribed track quality', {
          trackSource: publication.source,
          error,
        });
      }
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    };
  }, [room, determineTargetQuality]);

  React.useEffect(() => {
    applyQualityToRemoteTracks(lastNetworkQuality.current);
  }, [preferredQuality, applyQualityToRemoteTracks]);
}

