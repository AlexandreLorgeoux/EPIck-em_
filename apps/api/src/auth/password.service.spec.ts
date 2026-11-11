import { describe, expect, it } from '@jest/globals';
import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('hashes with argon2id and a random salt', async () => {
    const a = await passwords.hash('correct horse battery');
    const b = await passwords.hash('correct horse battery');
    expect(a).toMatch(/^\$argon2id\$/);
    expect(a).not.toBe(b);
  });

  it('accepts the right password and refuses a wrong one', async () => {
    const stored = await passwords.hash('correct horse battery');
    await expect(
      passwords.verify(stored, 'correct horse battery'),
    ).resolves.toBe(true);
    await expect(
      passwords.verify(stored, 'Correct horse battery'),
    ).resolves.toBe(false);
  });

  it('always refuses when there is no account to check against', async () => {
    await expect(
      passwords.verifyAgainstNothing('not-a-real-password'),
    ).resolves.toBe(false);
  });
});
