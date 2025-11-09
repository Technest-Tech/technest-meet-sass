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

// Play reaction sound based on type
export function playReactionSound(reactionType: ReactionType): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Resume context if needed (required for autoplay)
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        playReactionSound(reactionType);
      }).catch(() => {
        // User interaction required - sound will play on next interaction
      });
      return;
    }

    const currentTime = ctx.currentTime;

    switch (reactionType) {
      case '👍': // Thumbs up - Positive confirmation sound
        playTone(330, 0.2, 0, 'sine', 0.3);
        playTone(440, 0.15, 0.1, 'sine', 0.25);
        break;

      case '❤️': // Heart - Romantic chord progression
        playChord([523.25, 659.25, 783.99], 0.3, 0, 'sine', 0.25); // C-E-G major chord
        playTone(880, 0.2, 0.25, 'sine', 0.2); // A5
        break;

      case '😂': // Laughing - Bouncy, playful notes
        playTone(440, 0.1, 0, 'triangle', 0.3);
        playTone(554.37, 0.1, 0.08, 'triangle', 0.3);
        playTone(659.25, 0.1, 0.16, 'triangle', 0.3);
        playTone(783.99, 0.12, 0.24, 'triangle', 0.3);
        break;

      case '👏': // Clapping - Realistic clapping sound
        playClapSound();
        setTimeout(() => playClapSound(), 50);
        setTimeout(() => playClapSound(), 100);
        setTimeout(() => playClapSound(), 150);
        break;

      case '🎉': // Celebration - Fanfare with chord
        playTone(523.25, 0.2, 0, 'sine', 0.35); // C5
        playTone(659.25, 0.2, 0.1, 'sine', 0.35); // E5
        playTone(783.99, 0.2, 0.2, 'sine', 0.35); // G5
        playChord([1046.5, 1318.5], 0.3, 0.3, 'sine', 0.4); // C6-E6
        break;

      case '😮': // Surprised - Quick ascending whoosh
        playTone(440, 0.08, 0, 'sine', 0.25);
        playTone(880, 0.1, 0.05, 'sine', 0.3);
        playTone(1320, 0.12, 0.1, 'sine', 0.25);
        break;

      case '🙌': // Raising hands - Uplifting major chord
        playChord([440, 554.37, 659.25], 0.4, 0, 'sine', 0.3); // A-C#-E major
        playTone(880, 0.3, 0.2, 'sine', 0.25); // A5
        break;

      default:
        // Default sound for unknown reactions
        playTone(440, 0.15, 0, 'sine', 0.25);
    }
  } catch (error) {
    console.warn('Error playing reaction sound:', error);
  }
}

// Play raise hand sound
export function playRaiseHandSound(isRaised: boolean): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Resume context if needed (required for autoplay)
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        playRaiseHandSound(isRaised);
      }).catch(() => {
        // User interaction required - sound will play on next interaction
      });
      return;
    }

    const currentTime = ctx.currentTime;

    if (isRaised) {
      // Raising hand - uplifting ascending notes
      playTone(440, 0.15, 0, 'sine', 0.3); // A4
      playTone(554.37, 0.15, 0.1, 'sine', 0.3); // C#5
      playTone(659.25, 0.2, 0.2, 'sine', 0.35); // E5
    } else {
      // Lowering hand - gentle descending notes
      playTone(659.25, 0.15, 0, 'sine', 0.25); // E5
      playTone(554.37, 0.15, 0.1, 'sine', 0.25); // C#5
      playTone(440, 0.2, 0.2, 'sine', 0.25); // A4
    }
  } catch (error) {
    console.warn('Error playing raise hand sound:', error);
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

