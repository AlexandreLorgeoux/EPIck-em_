import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { UserRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase, signedInAs } from './test-app.js';

const UNKNOWN_ID = '0190a7c0-0000-7000-8000-000000000000';

type Slot = {
  state: string;
  team: { name: string } | null;
  score: number | null;
  winner: boolean;
};
type Match = {
  id: string;
  label: string;
  state: string;
  hasResult: boolean;
  slots: Slot[];
};
type Bracket = { rounds: { round: number; matches: Match[] }[] };

describe('Match results (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookies: Record<UserRole, string>;

  const server = () => app.getHttpServer();
  const as = (role: UserRole) => ({
    post: (url: string) =>
      request(server()).post(url).set('Cookie', cookies[role]),
    put: (url: string) =>
      request(server()).put(url).set('Cookie', cookies[role]),
  });
  const admin = () => as('admin');

  // A running tournament of `count` teams named "Seed n", seeded in order
  const running = async (count: number) => {
    const t = (
      await admin()
        .post('/tournaments')
        .send({ name: 'Winter Cup', game: 'Rocket League' })
        .expect(201)
    ).body as { id: string };
    const teamIds: string[] = [];
    for (let i = 1; i <= count; i++) {
      const team = await prisma.team.create({ data: { name: `Seed ${i}` } });
      await admin()
        .post(`/tournaments/${t.id}/teams`)
        .send({ teamId: team.id })
        .expect(201);
      teamIds.push(team.id);
    }
    await admin()
      .put(`/tournaments/${t.id}/seeding`)
      .send({ teamIds })
      .expect(200);
    const bracket = (
      await admin()
        .post(`/tournaments/${t.id}/bracket`)
        .send({ seeding: 'manual' })
        .expect(201)
    ).body as Bracket;
    return { id: t.id, bracket };
  };

  const matchOf = (bracket: Bracket, round: number, position: number) =>
    bracket.rounds.find((r) => r.round === round)!.matches[position - 1];

  const enter = (matchId: string, scores: unknown, winnerSlot: unknown) =>
    admin().post(`/matches/${matchId}/result`).send({ scores, winnerSlot });

  const correct = (
    matchId: string,
    scores: number[],
    winnerSlot: number,
    reason: string,
  ) =>
    admin()
      .post(`/matches/${matchId}/result`)
      .send({ scores, winnerSlot, reason });

  // "Seed 1 3 - 1 Seed 4", or "open" for a team not known yet
  const line = (match: Match) =>
    match.slots
      .map((s) =>
        s.team
          ? `${s.team.name}${s.score === null ? '' : ` ${s.score}`}`
          : s.state,
      )
      .join(' - ');

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    cookies = {
      admin: (await signedInAs(app, 'admin')).cookie,
      player: (await signedInAs(app, 'player')).cookie,
      user: (await signedInAs(app, 'user')).cookie,
    };
  });

  afterAll(async () => {
    await app.close();
  });

  describe('permissions', () => {
    const url = `/matches/${UNKNOWN_ID}/result`;

    it('rejects anonymous visitors with 401', async () => {
      await request(server()).post(url).expect(401);
    });

    it('rejects users and players with 403', async () => {
      await as('user').post(url).expect(403);
      await as('player').post(url).expect(403);
    });

    it('lets admins through', async () => {
      await enter(UNKNOWN_ID, [1, 0], 1).expect(404);
    });
  });

  describe('entering a score', () => {
    it('saves the result and moves the winner to the next match', async () => {
      const { bracket } = await running(4);
      const semi = matchOf(bracket, 1, 1);

      const res = await enter(semi.id, [1, 3], 2).expect(201);

      const played = matchOf(res.body, 1, 1);
      expect(played.state).toBe('decided');
      expect(line(played)).toBe('Seed 1 1 - Seed 4 3');
      expect(played.slots.map((s) => s.winner)).toEqual([false, true]);
      expect(line(matchOf(res.body, 2, 1))).toBe('Seed 4 - open');
    });

    it('keeps the raw result with its teams, score and author', async () => {
      const { bracket } = await running(2);
      const final = matchOf(bracket, 1, 1);
      await enter(final.id, [2, 0], 1).expect(201);

      const result = await prisma.matchResult.findFirstOrThrow({
        include: {
          entrants: {
            orderBy: { slotPosition: 'asc' },
            include: { registration: { include: { team: true } } },
          },
          rounds: { include: { scores: { orderBy: { slotPosition: 'asc' } } } },
          reportedBy: true,
        },
      });
      expect(result).toMatchObject({
        matchId: final.id,
        version: 1,
        outcomeKind: 'played',
        declaredWinnerSlot: 1,
        reportedBy: { displayName: 'admin' },
      });
      expect(result.entrants.map((e) => e.registration.team!.name)).toEqual([
        'Seed 1',
        'Seed 2',
      ]);
      expect(result.rounds).toHaveLength(1);
      expect(result.rounds[0].scores.map((s) => s.score)).toEqual([2, 0]);
      const outcome = await prisma.matchOutcome.findUniqueOrThrow({
        where: { matchId: final.id },
      });
      expect(outcome.resultId).toBe(result.id);
    });

    it('finishes the tournament once the final is played', async () => {
      const { id, bracket } = await running(3);
      // Seed 1 has a bye: one semi-final, then the final
      const semi = matchOf(bracket, 1, 2);
      const afterSemi = (await enter(semi.id, [2, 1], 1).expect(201))
        .body as Bracket;
      const final = matchOf(afterSemi, 2, 1);
      expect(line(final)).toBe('Seed 1 - Seed 2');

      const status = async () =>
        (await request(server()).get(`/tournaments/${id}`).expect(200)).body
          .status as string;
      expect(await status()).toBe('running');
      await enter(final.id, [0, 4], 2).expect(201);
      expect(await status()).toBe('finished');
      const list = await request(server())
        .get('/tournaments?status=finished')
        .expect(200);
      expect(list.body).toHaveLength(1);
    });
  });

  describe('validation', () => {
    it('refuses a tie, on the scores field', async () => {
      const { bracket } = await running(2);
      const res = await enter(matchOf(bracket, 1, 1).id, [2, 2], 1).expect(400);
      expect(res.body.errors).toEqual({
        scores: [
          'A match cannot end in a tie: enter the score that decided it',
        ],
      });
    });

    it('refuses a winner that does not have the higher score', async () => {
      const { bracket } = await running(2);
      const res = await enter(matchOf(bracket, 1, 1).id, [3, 1], 2).expect(400);
      expect(res.body.errors).toEqual({
        winnerSlot: ['winnerSlot must be the slot with the higher score'],
      });
      expect(await prisma.matchResult.count()).toBe(0);
    });

    it('explains malformed scores and winner', async () => {
      const res = await enter(UNKNOWN_ID, [3, -1, 2], 'home').expect(400);
      expect(res.body.errors).toEqual({
        scores: [
          'each score must be 0 or more',
          'scores must be two scores, slot 1 first',
        ],
        winnerSlot: ['winnerSlot must be 1 or 2'],
      });
      const decimals = await enter(UNKNOWN_ID, [1.5, 0], 1).expect(400);
      expect(decimals.body.errors).toEqual({
        scores: ['each score must be a whole number'],
      });
    });

    it('answers 404 for an unknown match', async () => {
      const res = await enter(UNKNOWN_ID, [1, 0], 1).expect(404);
      expect(res.body.message).toBe(`No match ${UNKNOWN_ID}`);
    });
  });

  describe('matches that cannot take a result', () => {
    it('needs both teams to be known', async () => {
      const { bracket } = await running(4);
      const final = matchOf(bracket, 2, 1);
      const res = await enter(final.id, [1, 0], 1).expect(409);
      expect(res.body.message).toBe(
        `${final.label} cannot be played yet: both teams are not known`,
      );
    });

    it('refuses a match decided by a bye', async () => {
      const { bracket } = await running(3);
      const bye = matchOf(bracket, 1, 1);
      const res = await enter(bye.id, [1, 0], 1).expect(409);
      expect(res.body.message).toBe(
        `${bye.label} has a bye: there is no result to enter`,
      );
    });

    it('needs a reason to change a result, on the reason field', async () => {
      const { bracket } = await running(2);
      const final = matchOf(bracket, 1, 1);
      await enter(final.id, [1, 0], 1).expect(201);
      const res = await enter(final.id, [0, 1], 2).expect(400);
      expect(res.body.errors).toEqual({
        reason: [
          `reason is required to correct ${final.label}: say why the result changes`,
        ],
      });
      expect(await prisma.matchResult.count()).toBe(1);
    });

    it('keeps one result when two are entered at the same time', async () => {
      const { bracket } = await running(2);
      const final = matchOf(bracket, 1, 1);
      const answers = await Promise.all([
        enter(final.id, [1, 0], 1),
        enter(final.id, [0, 1], 2),
      ]);
      expect(answers.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 400,
      ]);
      expect(await prisma.matchResult.count()).toBe(1);
    });
  });

  describe('correcting a result', () => {
    it('adds a version with its reason and moves the new winner forward', async () => {
      const { bracket } = await running(4);
      const semi = matchOf(bracket, 1, 1);
      await enter(semi.id, [3, 1], 1).expect(201);

      const res = await correct(
        semi.id,
        [1, 3],
        2,
        'Scores entered the wrong way round',
      ).expect(201);

      expect(line(matchOf(res.body, 1, 1))).toBe('Seed 1 1 - Seed 4 3');
      expect(line(matchOf(res.body, 2, 1))).toBe('Seed 4 - open');
      const versions = await prisma.matchResult.findMany({
        where: { matchId: semi.id },
        orderBy: { version: 'asc' },
      });
      expect(
        versions.map((v) => [v.version, v.declaredWinnerSlot, v.reason]),
      ).toEqual([
        [1, 1, null],
        [2, 2, 'Scores entered the wrong way round'],
      ]);
      // The earlier version is kept, and linked from the new one
      expect(versions[1].supersedesId).toBe(versions[0].id);
    });

    it('marks a later result stale when its teams change, until it is corrected', async () => {
      const { id, bracket } = await running(4);
      const [semi1, semi2] = [matchOf(bracket, 1, 1), matchOf(bracket, 1, 2)];
      await enter(semi1.id, [2, 0], 1).expect(201);
      await enter(semi2.id, [2, 0], 1).expect(201);
      const final = matchOf(bracket, 2, 1);
      await enter(final.id, [2, 1], 1).expect(201);
      const status = async () =>
        (await request(server()).get(`/tournaments/${id}`).expect(200)).body
          .status as string;
      expect(await status()).toBe('finished');

      // Seed 4 actually won the first semi-final: the final named Seed 1
      const afterFix = (
        await correct(semi1.id, [0, 2], 2, 'Wrong winner').expect(201)
      ).body as Bracket;
      const staleFinal = matchOf(afterFix, 2, 1);
      expect(staleFinal.state).toBe('stale');
      expect(staleFinal.hasResult).toBe(true);
      expect(staleFinal.slots.map((s) => s.team?.name)).toEqual([
        'Seed 4',
        'Seed 2',
      ]);
      expect(staleFinal.slots.some((s) => s.winner)).toBe(false);
      expect(await status()).toBe('running');

      const fixed = (
        await correct(final.id, [3, 0], 1, 'Replayed with Seed 4').expect(201)
      ).body as Bracket;
      expect(matchOf(fixed, 2, 1).state).toBe('decided');
      expect(line(matchOf(fixed, 2, 1))).toBe('Seed 4 3 - Seed 2 0');
      expect(await status()).toBe('finished');
    });

    it('explains a reason that is too short', async () => {
      const { bracket } = await running(2);
      const final = matchOf(bracket, 1, 1);
      await enter(final.id, [1, 0], 1).expect(201);
      const res = await correct(final.id, [0, 1], 2, 'no').expect(400);
      expect(res.body.errors).toEqual({
        reason: ['reason must be between 3 and 500 characters'],
      });
    });

    it('says which matches have a result', async () => {
      const { bracket } = await running(3);
      expect(matchOf(bracket, 1, 1).hasResult).toBe(false); // the bye
      const semi = matchOf(bracket, 1, 2);
      const res = await enter(semi.id, [1, 0], 1).expect(201);
      expect(matchOf(res.body, 1, 2).hasResult).toBe(true);
      expect(matchOf(res.body, 2, 1).hasResult).toBe(false);
    });
  });
});
