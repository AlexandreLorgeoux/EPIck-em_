import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { Trim } from './trim.js';

class Input {
  @Trim()
  value: unknown;
}

const trim = (value: unknown) => plainToInstance(Input, { value }).value;

describe('Trim', () => {
  it('removes surrounding spaces and line breaks', () => {
    expect(trim('  Alpha \n')).toBe('Alpha');
  });

  it('keeps inner spaces', () => {
    expect(trim(' Alpha Esports ')).toBe('Alpha Esports');
  });

  it('leaves values that are not strings for the validators to reject', () => {
    expect(trim(null)).toBeNull();
    expect(trim(42)).toBe(42);
  });
});
