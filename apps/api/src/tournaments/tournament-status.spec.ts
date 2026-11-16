import { describe, expect, it } from '@jest/globals';
import { tournamentStatus } from './tournament-status.js';

describe('tournamentStatus', () => {
  it('is draft until the tournament is started', () => {
    expect(tournamentStatus('draft')).toBe('draft');
    expect(tournamentStatus('draft', { total: 3, decided: 3 })).toBe('draft');
  });

  it('is running once started, with no match yet or matches left to play', () => {
    expect(tournamentStatus('published')).toBe('running');
    expect(tournamentStatus('published', { total: 7, decided: 6 })).toBe(
      'running',
    );
  });

  it('is finished when every match is decided', () => {
    expect(tournamentStatus('published', { total: 7, decided: 7 })).toBe(
      'finished',
    );
  });

  it('is finished once archived', () => {
    expect(tournamentStatus('archived')).toBe('finished');
  });
});
