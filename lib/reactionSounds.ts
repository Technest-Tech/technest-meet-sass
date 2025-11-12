'use client';

import { ReactionType } from './types';

// Audio context singleton
let audioContext: AudioContext | null = null;

// Initialize audio context (handles browser autoplay restrictions)
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
      return null;
    }
  }
  
  // Resume context if suspended (required for autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {
      // Silently fail if user hasn't interacted yet
    });
  }
  
  return audioContext;
}

// Play a tone at a specific frequency and duration
function playTone(
  frequency: number,
  duration: number,
  startTime: number = 0,
  type: OscillatorType = 'sine',
  volume: number = 0.3
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0, ctx.currentTime + startTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);

    oscillator.start(ctx.currentTime + startTime);
    oscillator.stop(ctx.currentTime + startTime + duration);
  } catch (error) {
    console.warn('Error playing tone:', error);
  }
}

// Play a chord (multiple frequencies simultaneously)
function playChord(
  frequencies: number[],
  duration: number,
  startTime: number = 0,
  type: OscillatorType = 'sine',
  volume: number = 0.25
): void {
  frequencies.forEach((freq, index) => {
    playTone(freq, duration, startTime + index * 0.02, type, volume / frequencies.length);
  });
}

// Create a more realistic clapping sound using noise
function playClapSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const bufferSize = ctx.sampleRate * 0.1; // 100ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate white noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Apply bandpass filter to make it sound more like clapping
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 1;

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    source.start(ctx.currentTime);
    source.stop(ctx.currentTime + 0.1);
  } catch (error) {
    console.warn('Error playing clap sound:', error);
    // Fallback to simple tone
    playTone(300, 0.05, 0, 'sine', 0.2);
  }
}

// Play audio file with 3 second limit
function playAudioFile(src: string, maxDuration: number = 3): void {
  try {
    const audio = new Audio(src);
    audio.volume = 0.7;
    
    // Stop after maxDuration seconds
    const stopTimeout = setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, maxDuration * 1000);
    
    audio.play().catch((error) => {
      console.warn('Error playing audio file:', error);
      clearTimeout(stopTimeout);
    });
    
    // Clean up when audio ends naturally
    audio.addEventListener('ended', () => {
      clearTimeout(stopTimeout);
    });
  } catch (error) {
    console.warn('Error creating audio element:', error);
  }
}

// Play reaction sound based on type
export function playReactionSound(reactionType: ReactionType): void {
  try {
    // Map reactions to sound files
    const soundMap: Record<ReactionType, string> = {
      '👍': '/365scores_like.mp3',
      '❤️': '/my_love.mp3',
      '😂': '/laughs.mp3',
      '👏': '/clap.mp3',
      '🎉': '/children_celebrating.mp3',
      '😮': '/wow.mp3',
      '🙌': '/wow.mp3',
    };

    const soundFile = soundMap[reactionType];
    if (soundFile) {
      playAudioFile(soundFile, 3);
    } else {
      // Fallback to default sound
      playAudioFile('/wow.mp3', 3);
    }
  } catch (error) {
    console.warn('Error playing reaction sound:', error);
  }
}

// Play raise hand sound
export function playRaiseHandSound(isRaised: boolean): void {
  try {
    if (isRaised) {
      // Raising hand - play default gentle sound
      playAudioFile('/365scores_like.mp3', 1);
    } else {
      // Lowering hand - no sound needed
      // Just a brief confirmation if needed
    }
  } catch (error) {
    console.warn('Error playing raise hand sound:', error);
  }
}

// Play notification sound for guest join request
export function playGuestJoinNotificationSound(): void {
  const ctx = getAudioContext();
  if (!ctx) {
    console.warn('🔇 Audio context not available');
    return;
  }

  try {
    console.log('🔊 Audio context state:', ctx.state);
    
    // Resume context if needed (required for autoplay)
    if (ctx.state === 'suspended') {
      console.log('🔊 Resuming audio context...');
      ctx.resume().then(() => {
        console.log('✅ Audio context resumed, playing sound');
        playGuestJoinNotificationSound();
      }).catch((err) => {
        console.warn('⚠️ Could not resume audio context:', err);
      });
      return;
    }

    console.log('🔔 Playing guest join notification sound');
    // Pleasant notification sound - three-tone ascending chime
    playTone(587.33, 0.15, 0, 'sine', 0.4); // D5
    playTone(783.99, 0.2, 0.1, 'sine', 0.45); // G5
    playTone(987.77, 0.25, 0.2, 'sine', 0.4); // B5
  } catch (error) {
    console.error('❌ Error playing guest join notification sound:', error);
  }
}

// Cleanup audio context (call on unmount)
export function cleanupAudioContext(): void {
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch(() => {
      // Ignore errors during cleanup
    });
    audioContext = null;
  }
}

