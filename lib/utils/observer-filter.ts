/**
 * Utility functions for filtering observer participants
 * Observers should be completely invisible in all UI components
 */

import { Participant } from 'livekit-client';

/**
 * Check if a participant is an observer
 * @param participant The participant to check
 * @returns true if the participant is an observer, false otherwise
 */
export function isObserver(participant: Participant | any): boolean {
  if (!participant) {
    return false;
  }

  // Check metadata for observer type
  try {
    const metadata = JSON.parse(participant.metadata || '{}');
    if (metadata.type === 'observer') {
      return true;
    }
  } catch (error) {
    // Metadata parsing failed, continue to other checks
  }

  // Check identity for observer pattern
  if (participant.identity?.includes('_observer_')) {
    return true;
  }

  return false;
}

/**
 * Filter out observers from a list of participants
 * @param participants Array of participants to filter
 * @returns Array of participants with observers removed
 */
export function filterObservers<T extends Participant | any>(participants: T[]): T[] {
  return participants.filter(p => !isObserver(p));
}

/**
 * Get the count of non-observer participants
 * @param participants Array of participants to count
 * @returns Number of non-observer participants
 */
export function countVisibleParticipants(participants: (Participant | any)[]): number {
  return filterObservers(participants).length;
}


