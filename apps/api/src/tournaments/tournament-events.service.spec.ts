import { describe, expect, it } from '@jest/globals';
import { firstValueFrom, lastValueFrom, take, toArray } from 'rxjs';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TournamentEventsService } from './tournament-events.service.js';

// The latest audit entry id is the tournament's version
const withVersion = (id: bigint | null) =>
  new TournamentEventsService({
    scoreAuditLog: { aggregate: async () => ({ _max: { id } }) },
  } as unknown as PrismaService);

describe('TournamentEventsService', () => {
  it('starts every stream with a sync event carrying the version', async () => {
    const events = withVersion(7n);
    const first = await firstValueFrom(await events.stream('t1'));
    expect(first).toEqual({
      type: 'sync',
      id: '7',
      retry: 3000,
      data: { version: '7', missed: false },
    });
  });

  it('tells a reconnecting client whether it missed changes', async () => {
    const events = withVersion(7n);
    const behind = await firstValueFrom(await events.stream('t1', '5'));
    expect(behind.data).toEqual({ version: '7', missed: true });
    const upToDate = await firstValueFrom(await events.stream('t1', '7'));
    expect(upToDate.data).toEqual({ version: '7', missed: false });
    // Garbage in Last-Event-ID is ignored
    const garbage = await firstValueFrom(await events.stream('t1', 'abc'));
    expect(garbage.data).toEqual({ version: '7', missed: false });
  });

  it('starts at version 0 before any result', async () => {
    const first = await firstValueFrom(await withVersion(null).stream('t1'));
    expect(first.id).toBe('0');
  });

  it("sends only the tournament's own changes, with the new version", async () => {
    const events = withVersion(7n);
    const received = lastValueFrom(
      (await events.stream('t1')).pipe(take(4), toArray()),
    );
    events.publish('t2', 9n, [{ type: 'leaderboard' }]);
    events.publish('t1', 8n, [
      { type: 'match-result', data: { matchId: 'm1' } },
      { type: 'bracket' },
      { type: 'leaderboard' },
    ]);
    expect(await received).toEqual([
      expect.objectContaining({ type: 'sync' }),
      { type: 'match-result', id: '8', data: { matchId: 'm1', version: '8' } },
      { type: 'bracket', id: '8', data: { version: '8' } },
      { type: 'leaderboard', id: '8', data: { version: '8' } },
    ]);
  });

  it('ends the open streams when the application stops', async () => {
    const events = withVersion(1n);
    const all = lastValueFrom((await events.stream('t1')).pipe(toArray()));
    events.onModuleDestroy();
    expect((await all).map((e) => e.type)).toEqual(['sync']);
  });
});
