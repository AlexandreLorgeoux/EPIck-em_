import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase, signedInAs } from './test-app.js';

type Slot = { team: { id: string } | null };
type Match = { id: string; state: string; slots: Slot[] };
type Bracket = { rounds: { round: number; matches: Match[] }[] };
type Prediction = { match: { id: string }; status: string; points: number };

describe('Scoring and prediction resolution (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: string;

  const server = () => app.getHttpServer();
  const as = (cookie: string) => ({
    get: (url: string) => request(server()).get(url).set('Cookie', cookie),
    post: (url: string) => request(server()).post(url).set('Cookie', cookie),
    put: (url: string) => request(server()).put(url).set('Cookie', cookie),
  });

  // A running tournament of 4 teams, seeded in order: Match 1 is seed 1
  // against seed 4, Match 2 seed 2 against seed 3, Match 3 the final
  const running = async () => {
    const t = (
      await as(admin)
        .post('/tournaments')
        .send({ name: 'Winter Cup', game: 'Rocket League' })
        .expect(201)
    ).body as { id: string; slug: string };
    const teamIds: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const team = await prisma.team.create({ data: { name: `Seed ${i}` } });
      await as(admin)
        .post(`/tournaments/${t.id}/teams`)
        .send({ teamId: team.id })
        .expect(201);
      teamIds.push(team.id);
    }
    await as(admin)
      .put(`/tournaments/${t.id}/seeding`)
      .send({ teamIds })
      .expect(200);
    const bracket = (
      await as(admin)
        .post(`/tournaments/${t.id}/bracket`)
        .send({ seeding: 'manual' })
        .expect(201)
    ).body as Bracket;
    return { ...t, teamIds, bracket };
  };

  const matchOf = (bracket: Bracket, round: number, position: number) =>
    bracket.rounds.find((r) => r.round === round)!.matches[position - 1];

  const predict = async (matchId: string, teamId: string, score?: number[]) => {
    const { cookie } = await signedInAs(app, 'user');
    await as(cookie)
      .post('/predictions')
      .send({ matchId, teamId, score })
      .expect(201);
    return cookie;
  };

  const enter = (matchId: string, scores: number[], winnerSlot: number) =>
    as(admin)
      .post(`/matches/${matchId}/result`)
      .send({ scores, winnerSlot })
      .expect(201)
      .then((res) => res.body as Bracket);

  // The only prediction of a user, as they see it
  const mine = async (cookie: string) =>
    (
      (await as(cookie).get('/me/predictions').expect(200)).body as Prediction[]
    )[0];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = (await signedInAs(app, 'admin')).cookie;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('scoring config', () => {
    it('shows the defaults to anyone once the tournament is public', async () => {
      const { id } = await running();
      const res = await request(server())
        .get(`/tournaments/${id}/scoring`)
        .expect(200);
      expect(res.body).toEqual({
        pointsCorrectPick: 3,
        exactScoreBonus: 2,
        roundIncrement: 1,
        isDefault: true,
        updatedAt: null,
      });
    });

    it('keeps the scoring of a draft hidden like the draft', async () => {
      const draft = (
        await as(admin)
          .post('/tournaments')
          .send({ name: 'Draft Cup', game: 'Rocket League' })
          .expect(201)
      ).body as { id: string };
      await request(server())
        .get(`/tournaments/${draft.id}/scoring`)
        .expect(404);
      await as(admin).get(`/tournaments/${draft.id}/scoring`).expect(200);
    });

    it('lets only admins change it', async () => {
      const { id } = await running();
      const body = {
        pointsCorrectPick: 5,
        exactScoreBonus: 1,
        roundIncrement: 0,
      };
      await request(server())
        .put(`/tournaments/${id}/scoring`)
        .send(body)
        .expect(401);
      for (const role of ['user', 'player'] as const) {
        const { cookie } = await signedInAs(app, role);
        await as(cookie)
          .put(`/tournaments/${id}/scoring`)
          .send(body)
          .expect(403);
      }
    });

    it('saves new points and logs who changed what', async () => {
      const { id } = await running();
      const res = await as(admin)
        .put(`/tournaments/${id}/scoring`)
        .send({ pointsCorrectPick: 5, exactScoreBonus: 1, roundIncrement: 0 })
        .expect(200);
      expect(res.body).toMatchObject({
        pointsCorrectPick: 5,
        exactScoreBonus: 1,
        roundIncrement: 0,
        isDefault: false,
      });

      const [entry] = await prisma.scoreAuditLog.findMany({
        include: { actor: true },
      });
      expect(entry).toMatchObject({
        tournamentId: id,
        matchId: null,
        action: 'scoring_changed',
        oldValue: {
          pointsCorrectPick: 3,
          exactScoreBonus: 2,
          roundIncrement: 1,
          isDefault: true,
        },
        newValue: {
          pointsCorrectPick: 5,
          exactScoreBonus: 1,
          roundIncrement: 0,
        },
        actor: { role: 'admin' },
      });
    });

    it('explains wrong points, field by field', async () => {
      const { id } = await running();
      const res = await as(admin)
        .put(`/tournaments/${id}/scoring`)
        .send({ pointsCorrectPick: -1, exactScoreBonus: 1.5 })
        .expect(400);
      expect(res.body.errors).toEqual({
        pointsCorrectPick: ['pointsCorrectPick must be 0 or more'],
        exactScoreBonus: ['exactScoreBonus must be a whole number of points'],
        roundIncrement: [
          'roundIncrement must be 100 or less',
          'roundIncrement must be 0 or more',
          'roundIncrement must be a whole number of points',
        ],
      });
    });
  });

  describe('resolution when a result is entered', () => {
    it('marks each prediction correct or wrong and awards its points', async () => {
      const { bracket, teamIds } = await running();
      const match1 = matchOf(bracket, 1, 1);
      // Seed 1 wins Match 1, 3-1
      const exact = await predict(match1.id, teamIds[0], [3, 1]);
      const winnerOnly = await predict(match1.id, teamIds[0]);
      const wrongScore = await predict(match1.id, teamIds[0], [2, 0]);
      const loser = await predict(match1.id, teamIds[3], [1, 3]);
      const otherMatch = await predict(matchOf(bracket, 1, 2).id, teamIds[1]);

      await enter(match1.id, [3, 1], 1);

      expect(await mine(exact)).toMatchObject({ status: 'correct', points: 5 });
      expect(await mine(winnerOnly)).toMatchObject({
        status: 'correct',
        points: 3,
      });
      expect(await mine(wrongScore)).toMatchObject({
        status: 'correct',
        points: 3,
      });
      expect(await mine(loser)).toMatchObject({ status: 'wrong', points: 0 });
      // A match without a result leaves its predictions unresolved
      expect(await mine(otherMatch)).toMatchObject({
        status: 'pending',
        points: 0,
      });

      const resolved = await prisma.prediction.findMany({
        where: { matchId: match1.id },
      });
      expect(resolved.every((p) => p.resolvedAt !== null)).toBe(true);
      const pending = await prisma.prediction.findFirstOrThrow({
        where: { matchId: { not: match1.id } },
      });
      expect(pending.resolvedAt).toBeNull();
    });

    it('makes later rounds worth more', async () => {
      const { bracket, teamIds } = await running();
      await enter(matchOf(bracket, 1, 1).id, [2, 0], 1); // Seed 1
      const afterSemis = await enter(matchOf(bracket, 1, 2).id, [2, 0], 1); // Seed 2
      const final = matchOf(afterSemis, 2, 1);
      const winner = await predict(final.id, teamIds[0], [3, 2]);
      const loser = await predict(final.id, teamIds[1]);

      await enter(final.id, [3, 2], 1);

      // Round 2: 3 + 1 for the winner, plus 2 for the exact score
      expect(await mine(winner)).toMatchObject({
        status: 'correct',
        points: 6,
      });
      expect(await mine(loser)).toMatchObject({ status: 'wrong', points: 0 });
    });

    it('scores everything again with new points', async () => {
      const { id, bracket, teamIds } = await running();
      const match1 = matchOf(bracket, 1, 1);
      const exact = await predict(match1.id, teamIds[0], [3, 1]);
      const loser = await predict(match1.id, teamIds[3]);
      await enter(match1.id, [3, 1], 1);
      expect(await mine(exact)).toMatchObject({ points: 5 });

      await as(admin)
        .put(`/tournaments/${id}/scoring`)
        .send({ pointsCorrectPick: 10, exactScoreBonus: 5, roundIncrement: 0 })
        .expect(200);

      expect(await mine(exact)).toMatchObject({
        status: 'correct',
        points: 15,
      });
      expect(await mine(loser)).toMatchObject({ status: 'wrong', points: 0 });
    });

    it('saves the result, the bracket advance and the points together or not at all', async () => {
      const { bracket, teamIds } = await running();
      const match1 = matchOf(bracket, 1, 1);
      await predict(match1.id, teamIds[0]);
      // Make the scoring step fail inside the result's transaction
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION fail_prediction_update() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'scoring failed'; END; $$`);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER fail_prediction_update BEFORE UPDATE ON prediction
        FOR EACH ROW EXECUTE FUNCTION fail_prediction_update()`);
      try {
        await as(admin)
          .post(`/matches/${match1.id}/result`)
          .send({ scores: [3, 1], winnerSlot: 1 })
          .expect(500);
      } finally {
        await prisma.$executeRawUnsafe(
          'DROP TRIGGER fail_prediction_update ON prediction',
        );
        await prisma.$executeRawUnsafe(
          'DROP FUNCTION fail_prediction_update()',
        );
      }

      // No partial state: no result, the bracket did not move, the
      // prediction is still pending
      expect(await prisma.matchResult.count()).toBe(0);
      const outcome = await prisma.matchOutcome.findUniqueOrThrow({
        where: { matchId: match1.id },
      });
      expect(outcome.state).toBe('pending');
      const final = await prisma.matchSlot.findFirstOrThrow({
        where: { match: { bracketRound: 2 }, position: 1 },
        include: { assignment: true },
      });
      expect(final.assignment?.state).toBe('open');
      expect((await prisma.prediction.findFirstOrThrow()).status).toBe(
        'pending',
      );
    });
  });
});
