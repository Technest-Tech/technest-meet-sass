/**
 * Quality Adjustment Lock System
 * 
 * Prevents multiple quality adjustments from happening simultaneously,
 * which causes race conditions and track instability when participants join.
 * 
 * This ensures only one quality adjustment happens at a time per participant,
 * preventing camera/microphone from stopping unexpectedly.
 */

interface AdjustmentPromise {
  promise: Promise<void>;
  timestamp: number;
}

class QualityAdjustmentLock {
  private adjustments: Map<string, AdjustmentPromise>;
  private readonly ADJUSTMENT_TIMEOUT = 5000; // 5 seconds max adjustment duration

  constructor() {
    this.adjustments = new Map();
  }

  /**
   * Execute a quality adjustment safely, waiting for any pending adjustments
   * for the same participant
   */
  async executeSafely(
    participantId: string,
    adjustment: () => Promise<void>
  ): Promise<void> {
    // Wait for any pending adjustment for this participant
    const pending = this.adjustments.get(participantId);
    if (pending) {
      try {
        await pending.promise;
      } catch (error) {
        // Ignore errors from previous adjustment
        logger.debug('Previous adjustment completed with error:', error);
      }
    }

    // Create new promise for this adjustment
    const adjustmentPromise = (async () => {
      try {
        await adjustment();
      } finally {
        // Clean up after a delay to allow for any follow-up operations
        setTimeout(() => {
          this.adjustments.delete(participantId);
        }, 1000);
      }
    })();

    // Store the promise
    this.adjustments.set(participantId, {
      promise: adjustmentPromise,
      timestamp: Date.now(),
    });

    // Set timeout to clean up if adjustment takes too long
    setTimeout(() => {
      const stored = this.adjustments.get(participantId);
      if (stored && stored.timestamp === this.adjustments.get(participantId)?.timestamp) {
        this.adjustments.delete(participantId);
      }
    }, this.ADJUSTMENT_TIMEOUT);

    await adjustmentPromise;
  }

  /**
   * Check if an adjustment is currently in progress for a participant
   */
  isAdjusting(participantId: string): boolean {
    return this.adjustments.has(participantId);
  }

  /**
   * Clear all adjustments (for cleanup)
   */
  clear(): void {
    this.adjustments.clear();
  }
}

// Import logger
import { logger } from './logger';

// Export singleton instance
export const qualityAdjustmentLock = new QualityAdjustmentLock();

