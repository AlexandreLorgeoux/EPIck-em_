import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { UserRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { BracketRecomputeService } from '../src/tournaments/bracket-recompute.service.js';
import { createTestApp, resetDatabase, signedInAs } from './test-app.js';

type Slot = { team: { name: string } | null };
type Match = { id: string; state: string; slots: Slot[] };
type Bracket = { rounds: { round: number; matches: Match[] }[] };

// Ticket #51: a correction keeps the bracket, predictions and points
// consistent, and leaves a trace
describe('Result corrections (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: { cookie: string; user: { id: string } };

  const server = () => app.getHttpServer();
  const as = (cookie: string) => ({
    get: (url: string) => request(server()).get(url).set('Cookie', cookie),
    post: (url: string) => request(server()).post(url).set('Cookie', cookie),
    put: (url: string) => request(server()).put(url).set('Cookie', cookie),
  });

  // 4 teams seeded in order: Match 1 is Seed 1 against Seed 4, Match 2
  // Seed 2 against Seed 3, Match 3 the final
  const running = async () => {
    const t = (
      await as(admin.cookie)
        .post('/tournaments')
        .send({ name: 'Winter Cup', game: 'Rocket League' })
        .expect(201)
    ).body as { id: string };
    const teamIds: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const team = await prisma.team.create({ data: { name: `Seed ${i}` } });
      await as(admin.cookie)
        .post(`/tournaments/${t.id}/teams`)
        .send({ teamId: team.id })
        .expect(201);
      teamIds.push(team.id);
    }
    await as(admin.cookie)
      .put(`/tournaments/${t.id}/seeding`)
      .send({ teamIds })
      .expect(200);
    const bracket = (
      await as(admin.cookie)
        .post(`/tournaments/${t.id}/bracket`)
        .send({ seeding: 'manual' })
        .expect(201)
    ).body as Bracket;
    const match = (round: number, position: number) =>
      bracket.rounds.find((r) => r.round === round)!.matches[position - 1];
    return { id: t.id, teamIds, match };
  };

  const enter = (
    matchId: string,
    scores: number[],
    winnerSlot: number,
    reason?: string,
  ) =>
    as(admin.cookie)
      .post(`/matches/${matchId}/result`)
      .send({ scores, winnerSlot, reason })
      .expect(201)
      .then((res) => res.body as Bracket);

  const predict = async (matchId: string, teamId: string) => {
    const { cookie, user } = await signedInAs(app, 'user');
    await as(cookie).post('/predictions').send({ matchId, teamId }).expect(201);
    return user.id;
  };

  const outcomeOf = async (userId: string) =>
    prisma.prediction.findFirstOrThrow({
      where: { userId },
      select: { status: true, points: true },
    });

  // Everything the recalculation writes for the tournament, in a stable order
  const derivedState = async (tournamentId: string) => {
    const ofTournament = { match: { stage: { tournamentId } } };
    return {
      outcomes: await prisma.matchOutcome.findMany({
        where: ofTournament,
        orderBy: { matchId: 'asc' },
        select: {
          matchId: true,
          state: true,
          resultId: true,
          winnerRegistrationId: true,
          loserRegistrationId: true,
        },
      }),
      slots: await prisma.slotAssignment.findMany({
        where: { matchSlot: ofTournament },
        orderBy: { matchSlotId: 'asc' },
        select: {
          matchSlotId: true,
          registrationId: true,
          state: true,
          resolvedFrom: true,
        },
      }),
      predictions: await prisma.prediction.findMany({
        where: ofTournament,
        orderBy: { id: 'asc' },
        select: { id: true, status: true, points: true },
      }),
    };
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = await signedInAs(app, 'admin');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('audit log', () => {
    it('records who entered and who corrected a result, with both values', async () => {
      const { id, match } = await running();
      const match1 = match(1, 1);
      await enter(match1.id, [3, 1], 1);
      await enter(match1.id, [1, 3], 2, 'Scores entered the wrong way round');

      const entries = await prisma.scoreAuditLog.findMany({
        orderBy: { id: 'asc' },
      });
      expect(entries).toHaveLength(2);
      expect(entries[0]).toMatchObject({
        tournamentId: id,
        matchId: match1.id,
        actorUserId: admin.user.id,
        action: 'result_recorded',
        oldValue: null,
        newValue: {
          version: 1,
          scores: [3, 1],
          winnerSlot: 1,
          teams: ['Seed 1', 'Seed 4'],
        },
        reason: null,
      });
      expect(entries[1]).toMatchObject({
        actorUserId: admin.user.id,
        action: 'result_corrected',
        oldValue: {
          version: 1,
          scores: [3, 1],
          winnerSlot: 1,
          teams: ['Seed 1', 'Seed 4'],
        },
        newValue: { version: 2, scores: [1, 3], winnerSlot: 2 },
        reason: 'Scores entered the wrong way round',
      });
      expect(entries[1].createdAt.getTime()).toBeGreaterThanOrEqual(
        entries[0].createdAt.getTime(),
      );
    });

    it('logs nothing when a result is refused', async () => {
      const { match } = await running();
      const match1 = match(1, 1);
      await enter(match1.id, [3, 1], 1);
      // A correction without a reason is refused
      await as(admin.cookie)
        .post(`/matches/${match1.id}/result`)
        .send({ scores: [1, 3], winnerSlot: 2 })
        .expect(400);
      expect(await prisma.scoreAuditLog.count()).toBe(1);
    });
  });

  describe('who can correct', () => {
    it.each(['user', 'player'] as UserRole[])(
      'refuses a correction by a %s',
      async (role) => {
        const { match } = await running();
        const match1 = match(1, 1);
        await enter(match1.id, [3, 1], 1);
        const { cookie } = await signedInAs(app, role);
        await as(cookie)
          .post(`/matches/${match1.id}/result`)
          .send({ scores: [1, 3], winnerSlot: 2, reason: 'I think so' })
          .expect(403);
        await request(server())
          .post(`/matches/${match1.id}/result`)
          .send({ scores: [1, 3], winnerSlot: 2, reason: 'Anonymous' })
          .expect(401);
        expect(await prisma.matchResult.count()).toBe(1);
        expect(await prisma.scoreAuditLog.count()).toBe(1);
      },
    );
  });

  describe('cascade', () => {
    it('recomputes the bracket, the predictions and the points after a correction', async () => {
      const { teamIds, match } = await running();
      const [semi1, semi2, final] = [match(1, 1), match(1, 2), match(2, 1)];
      const pickedSeed1 = await predict(semi1.id, teamIds[0]);
      const pickedSeed4 = await predict(semi1.id, teamIds[3]);
      await enter(semi1.id, [3, 1], 1); // Seed 1
      await enter(semi2.id, [3, 1], 1); // Seed 2
      const finalSeed1 = await predict(final.id, teamIds[0]);
      const finalSeed2 = await predict(final.id, teamIds[1]);
      await enter(final.id, [2, 0], 1); // Seed 1 wins the final

      expect(await outcomeOf(pickedSeed1)).toEqual({
        status: 'correct',
        points: 3,
      });
      expect(await outcomeOf(finalSeed1)).toEqual({
        status: 'correct',
        points: 4,
      });

      // Seed 4 actually won the first semi-final
      const corrected = await enter(semi1.id, [1, 3], 2, 'Wrong winner');

      expect(await outcomeOf(pickedSeed1)).toEqual({
        status: 'wrong',
        points: 0,
      });
      expect(await outcomeOf(pickedSeed4)).toEqual({
        status: 'correct',
        points: 3,
      });
      // The final named Seed 1, who no longer plays it: its result is
      // stale and its Seed 1 predictions are cancelled
      const finalNow = corrected.rounds[1].matches[0];
      expect(finalNow.state).toBe('stale');
      expect(finalNow.slots.map((s) => s.team?.name)).toEqual([
        'Seed 4',
        'Seed 2',
      ]);
      expect(await outcomeOf(finalSeed1)).toEqual({
        status: 'cancelled',
        points: 0,
      });
      expect(await outcomeOf(finalSeed2)).toEqual({
        status: 'pending',
        points: 0,
      });

      // The final is played again: Seed 2 beats Seed 4
      await enter(final.id, [0, 2], 2, 'Replayed with Seed 4');
      expect(await outcomeOf(finalSeed2)).toEqual({
        status: 'correct',
        points: 4,
      });
      expect(await outcomeOf(finalSeed1)).toEqual({
        status: 'cancelled',
        points: 0,
      });

      // Leaderboard totals follow: each user's points add up again
      const totals = await prisma.prediction.groupBy({
        by: ['userId'],
        _sum: { points: true },
      });
      const total = (userId: string) =>
        totals.find((t) => t.userId === userId)?._sum.points;
      expect(total(pickedSeed1)).toBe(0);
      expect(total(pickedSeed4)).toBe(3);
      expect(total(finalSeed2)).toBe(4);
    });

    it('ends in the same state as a full recalculation from scratch', async () => {
      const { id, teamIds, match } = await running();
      const [semi1, semi2, final] = [match(1, 1), match(1, 2), match(2, 1)];
      for (const teamId of [teamIds[0], teamIds[3], teamIds[0]]) {
        await predict(semi1.id, teamId);
      }
      await predict(semi2.id, teamIds[2]);
      await enter(semi1.id, [3, 1], 1);
      await enter(semi2.id, [2, 3], 2);
      await predict(final.id, teamIds[0]);
      await predict(final.id, teamIds[2]);
      await enter(final.id, [1, 0], 1);
      // A chain of changes: a correction, a scoring change, another one
      await enter(semi1.id, [0, 2], 2, 'Wrong winner');
      await as(admin.cookie)
        .put(`/tournaments/${id}/scoring`)
        .send({ pointsCorrectPick: 5, exactScoreBonus: 1, roundIncrement: 3 })
        .expect(200);
      await enter(final.id, [1, 3], 2, 'Replayed');
      await enter(semi2.id, [4, 0], 1, 'Disqualification overturned');

      const incremental = await derivedState(id);
      expect(
        incremental.predictions.filter((p) => p.status !== 'pending'),
      ).not.toHaveLength(0);

      const recompute = app.get(BracketRecomputeService);
      await prisma.$transaction((tx) => recompute.rebuild(tx, id));

      expect(await derivedState(id)).toEqual(incremental);
    });

    it('rebuilds a state that was wrong into the right one', async () => {
      const { id, teamIds, match } = await running();
      const semi1 = match(1, 1);
      const voter = await predict(semi1.id, teamIds[0]);
      await enter(semi1.id, [3, 1], 1);
      const right = await derivedState(id);

      // Damage the derived data, as a bug or a manual edit would
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.recompute', 'on', true)`;
        await tx.prediction.updateMany({
          where: { userId: voter },
          data: { status: 'wrong', points: 0 },
        });
      });
      expect(await derivedState(id)).not.toEqual(right);

      const recompute = app.get(BracketRecomputeService);
      await prisma.$transaction((tx) => recompute.rebuild(tx, id));
      expect(await derivedState(id)).toEqual(right);
    });
  });
});
