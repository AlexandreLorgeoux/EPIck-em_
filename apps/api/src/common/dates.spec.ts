import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { today } from './dates.js';

describe('today', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns midnight UTC of the current day', () => {
    jest.useFakeTimers({ now: new Date('2026-11-10T15:42:10Z') });
    expect(today().toISOString()).toBe('2026-11-10T00:00:00.000Z');
  });

  it('uses the UTC day, not the server time zone', () => {
    // 23:30 in New York is already the next day in UTC
    jest.useFakeTimers({ now: new Date('2026-11-10T23:30:00-05:00') });
    expect(today().toISOString()).toBe('2026-11-11T00:00:00.000Z');
  });
});
