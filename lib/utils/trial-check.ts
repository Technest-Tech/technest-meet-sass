import { prisma } from '@/lib/database';
import { Subscription, SubscriptionStatus } from '@prisma/client';

/**
 * Checks if a trial subscription has expired and updates it if necessary
 * @param subscription The subscription to check
 * @returns The updated subscription (or original if not expired)
 */
export async function checkTrialExpiration(
  subscription: Subscription
): Promise<Subscription> {
  // Only check if it's a trial subscription
  if (!subscription.isTrial || subscription.status !== 'TRIAL') {
    return subscription;
  }

  // Check if trial has expired
  if (subscription.trialEndDate && new Date() > subscription.trialEndDate) {
    // Trial expired - update status
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'TRIAL_EXPIRED' as SubscriptionStatus,
        isTrial: false,
      },
    });

    return updated;
  }

  return subscription;
}

/**
 * Checks if a trial subscription is currently active (not expired)
 * @param subscription The subscription to check
 * @returns True if trial is active and not expired
 */
export function isTrialActive(subscription: Subscription): boolean {
  if (!subscription.isTrial || subscription.status !== 'TRIAL') {
    return false;
  }

  // Check if trial end date has passed
  if (subscription.trialEndDate && new Date() > subscription.trialEndDate) {
    return false;
  }

  return true;
}

/**
 * Calculates the number of days remaining in a trial
 * @param subscription The subscription to check
 * @returns Number of days remaining (0 if expired or not a trial)
 */
export function getTrialDaysRemaining(subscription: Subscription): number {
  if (!subscription.isTrial || !subscription.trialEndDate) {
    return 0;
  }

  const now = new Date();
  const endDate = new Date(subscription.trialEndDate);
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Checks if a subscription status allows access (ACTIVE or TRIAL)
 * @param subscription The subscription to check
 * @returns True if subscription allows access
 */
export function isSubscriptionActive(subscription: Subscription | null): boolean {
  if (!subscription) {
    return false;
  }

  // Check if trial expired first
  if (subscription.isTrial && subscription.trialEndDate) {
    if (new Date() > subscription.trialEndDate) {
      return false;
    }
  }

  return subscription.status === 'ACTIVE' || subscription.status === 'TRIAL';
}

