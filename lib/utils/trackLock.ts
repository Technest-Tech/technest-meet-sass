/**
 * Track Modification Lock System
 * 
 * Prevents multiple components from modifying tracks simultaneously,
 * which causes race conditions and track instability.
 * 
 * This ensures only one component can modify a track at a time,
 * preventing unexpected camera/microphone stops.
 */

interface LockState {
  locked: boolean;
  lastModified: number;
  lockTimeout?: NodeJS.Timeout;
}

class TrackModificationLock {
  private locks: Map<string, LockState>;
  private readonly LOCK_TIMEOUT = 3000; // 3 seconds max lock duration
  private readonly COOLDOWN_PERIOD = 5000; // 5 seconds between modifications

  constructor() {
    this.locks = new Map();
  }

  /**
   * Check if a track is currently locked
   */
  isLocked(trackId: string): boolean {
    const lockState = this.locks.get(trackId);
    return lockState?.locked === true;
  }

  /**
   * Check if a track can be modified (not locked and not in cooldown)
   */
  canModify(trackId: string): boolean {
    if (this.isLocked(trackId)) {
      return false;
    }
    return !this.wasRecentlyModified(trackId);
  }

  /**
   * Acquire a lock on a track
   * Returns true if lock was acquired, false if already locked
   */
  async acquire(trackId: string): Promise<boolean> {
    // Check if already locked
    if (this.isLocked(trackId)) {
      return false;
    }

    // Check cooldown period
    if (this.wasRecentlyModified(trackId)) {
      return false;
    }

    // Acquire lock
    const lockState: LockState = {
      locked: true,
      lastModified: Date.now(),
    };

    // Set timeout to auto-release lock (safety mechanism)
    lockState.lockTimeout = setTimeout(() => {
      this.release(trackId);
    }, this.LOCK_TIMEOUT);

    this.locks.set(trackId, lockState);
    return true;
  }

  /**
   * Release a lock on a track
   */
  release(trackId: string): void {
    const lockState = this.locks.get(trackId);
    if (!lockState) {
      return;
    }

    // Clear timeout if exists
    if (lockState.lockTimeout) {
      clearTimeout(lockState.lockTimeout);
    }

    // Update last modified time and release lock
    lockState.locked = false;
    lockState.lastModified = Date.now();
    lockState.lockTimeout = undefined;

    this.locks.set(trackId, lockState);
  }

  /**
   * Check if track was recently modified (within cooldown period)
   */
  wasRecentlyModified(trackId: string): boolean {
    const lockState = this.locks.get(trackId);
    if (!lockState || !lockState.lastModified) {
      return false;
    }

    const timeSinceLastModification = Date.now() - lockState.lastModified;
    return timeSinceLastModification < this.COOLDOWN_PERIOD;
  }

  /**
   * Get time until track can be modified again (in milliseconds)
   * Returns 0 if track can be modified now
   */
  getTimeUntilModifiable(trackId: string): number {
    const lockState = this.locks.get(trackId);
    if (!lockState || !lockState.lastModified) {
      return 0;
    }

    const timeSinceLastModification = Date.now() - lockState.lastModified;
    const remaining = this.COOLDOWN_PERIOD - timeSinceLastModification;
    return Math.max(0, remaining);
  }

  /**
   * Clear all locks (for cleanup)
   */
  clear(): void {
    this.locks.forEach((lockState, trackId) => {
      if (lockState.lockTimeout) {
        clearTimeout(lockState.lockTimeout);
      }
    });
    this.locks.clear();
  }
}

// Export singleton instance
export const trackLock = new TrackModificationLock();

