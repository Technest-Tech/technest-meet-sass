/**
 * Health Check Lock System
 * 
 * Prevents multiple health check hooks from running simultaneously,
 * which causes race conditions and excessive track republishing.
 * 
 * This ensures only one health check runs at a time, preventing
 * conflicts between useAudioTrackHealth and useAudioStability hooks.
 */

class HealthCheckLock {
  private isChecking: boolean = false;
  private lastCheckTime: number = 0;
  private readonly MIN_INTERVAL = 2000; // Minimum 2 seconds between checks

  /**
   * Try to acquire the lock for health checking
   * Returns true if lock was acquired, false if another check is running
   */
  async acquire(): Promise<boolean> {
    const now = Date.now();
    
    // Don't allow checks within minimum interval
    if (this.isChecking || (now - this.lastCheckTime < this.MIN_INTERVAL)) {
      return false;
    }
    
    this.isChecking = true;
    this.lastCheckTime = now;
    return true;
  }

  /**
   * Release the lock
   */
  release(): void {
    this.isChecking = false;
  }

  /**
   * Check if a health check is currently running
   */
  isLocked(): boolean {
    return this.isChecking;
  }

  /**
   * Get time until next check can run (in milliseconds)
   */
  getTimeUntilNextCheck(): number {
    if (!this.isChecking) {
      return 0;
    }
    
    const now = Date.now();
    const timeSinceLastCheck = now - this.lastCheckTime;
    const remaining = this.MIN_INTERVAL - timeSinceLastCheck;
    return Math.max(0, remaining);
  }
}

// Export singleton instance
export const healthCheckLock = new HealthCheckLock();

