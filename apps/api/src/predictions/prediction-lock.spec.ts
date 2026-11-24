import { describe, expect, it } from '@jest/globals';
import { predictionLock, type LockableMatch } from './prediction-lock.js';

const now = new Date('2026-12-05T14:00:00Z');
const open: LockableMatch = {
  scheduledAt: null,
  played: false,
  slots: ['assigned', 'assigned'],
};

describe('predictionLock', () => {
  it('stays open while both teams are known and nothing started', () => {
    expect(predictionLock(open, now)).toBeNull();
    expect(
      predictionLock(
        { ...open, scheduledAt: new Date('2026-12-05T14:00:01Z') },
        now,
      ),
    ).toBeNull();
  });

  it('locks from the planned start, to the second', () => {
    expect(predictionLock({ ...open, scheduledAt: now }, now)).toBe('started');
    expect(
      predictionLock(
        { ...open, scheduledAt: new Date('2026-12-05T13:00:00Z') },
        now,
      ),
    ).toBe('started');
  });

  it('locks a match that has a result, even without a planned start', () => {
    expect(predictionLock({ ...open, played: true }, now)).toBe('played');
  });

  it('refuses a match whose teams are not both known yet', () => {
    expect(predictionLock({ ...open, slots: ['assigned', 'open'] }, now)).toBe(
      'teams-unknown',
    );
  });

  it('refuses a bye: there is no match to predict', () => {
    expect(predictionLock({ ...open, slots: ['assigned', 'bye'] }, now)).toBe(
      'bye',
    );
  });
});
