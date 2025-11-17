import { describe, expect, it, beforeEach, vi } from 'vitest';

const resetEnv = () => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.APP_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXTAUTH_URL;
  delete process.env.REFERRAL_TARGET_PATH;
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/mock';
};

describe('buildReferralShareUrl', () => {
  beforeEach(() => {
    resetEnv();
    vi.resetModules();
  });

  it('falls back to localhost when no base URL configured', async () => {
    const module = await import('../referrals');
    expect(module.buildReferralShareUrl('ABC123')).toBe('http://localhost:3000/?ref=ABC123');
  });

  it('appends query param and custom path when env is provided', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://almajd.com';
    process.env.REFERRAL_TARGET_PATH = '/register';
    vi.resetModules();
    const module = await import('../referrals');
    expect(module.buildReferralShareUrl('REFCODE')).toBe(
      'https://almajd.com/register?ref=REFCODE',
    );
  });
});

