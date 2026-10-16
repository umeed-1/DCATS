import { describe, it, expect, beforeEach } from 'vitest';
import {
  signIn,
  readSession,
  clearSession,
  validateUserId,
  validatePin,
  normalizeUserId,
} from './profile';

const uniqueId = () =>
  `T${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`.slice(0, 20);

describe('profile', () => {
  beforeEach(() => clearSession());

  it('validates user IDs and PINs', () => {
    expect(validateUserId('')).toMatch(/Enter/);
    expect(validateUserId('ab')).toMatch(/3–24/);
    expect(validateUserId('bad id')).toMatch(/3–24/);
    expect(validateUserId('AKASH-01')).toBeNull();

    expect(validatePin('12')).toMatch(/4–6/);
    expect(validatePin('1234567')).toMatch(/4–6/);
    expect(validatePin('12a4')).toMatch(/4–6/);
    expect(validatePin('1234')).toBeNull();

    expect(normalizeUserId('  AKASH-01  ')).toBe('AKASH-01');
  });

  it('creates a local profile, verifies the PIN, and keeps the session', async () => {
    const id = uniqueId();

    const session = await signIn(id, '4321');
    expect(session.userId).toBe(id);
    expect(readSession()?.userId).toBe(id);

    await expect(signIn(id, '0000')).rejects.toThrow(/PIN/);
    await expect(signIn(id, '4321')).resolves.toMatchObject({ userId: id });
  });

  it('matches the user ID case-insensitively and keeps the original casing', async () => {
    const id = uniqueId();
    await signIn(id, '1234');
    clearSession();

    const again = await signIn(id.toLowerCase(), '1234');
    expect(again.userId).toBe(id);
  });

  it('clears the active session on sign-out', async () => {
    await signIn(uniqueId(), '1111');
    expect(readSession()).not.toBeNull();
    clearSession();
    expect(readSession()).toBeNull();
  });
});
