import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase, signedInAs } from './test-app.js';

const UNKNOWN_ID = '0190a7c0-0000-7000-8000-000000000000';

type Slot = { state: string; team: { id: string; name: string } | null };
type Match = { id: string; label: string; slots: Slot[] };
type Bracket = { rounds: { round: number; matches: Match[] }[] };

describe('Predictions API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: string;

  const server = () => app.getHttpServer();
  const as = (cookie: string) => ({
    get: (url: string) => request(server()).get(url).set('Cookie', cookie),
    post: (url: string) => request(server()).post(url).set('Cookie', cookie),
    patch: (url: string) => request(server()).patch(url).set('Cookie', cookie),
  });

  // A running tournament of `count` teams "Seed n", seeded in order
  const running = async (count: number, name = 'Winter Cup') => {
    const t = (
      await as(admin)
        .post('/tournaments')
        .send({ name, game: 'Rocket League' })
        .expect(201)
    ).body as { id: string; slug: string };
    const teamIds: string[] = [];
    for (let i = 1; i <= count; i++) {
      const team = await prisma.team.create({
        data: { name: `${name} Seed ${i}` },
      });
      await as(admin)
        .post(`/tournaments/${t.id}/teams`)
        .send({ teamId: team.id })
        .expect(201);
      teamIds.push(team.id);
    }
    await request(server())
      .put(`/tournaments/${t.id}/seeding`)
      .set('Cookie', admin)
      .send({ teamIds })
      .expect(200);
    const bracket = (
      await as(admin)
        .post(`/tournaments/${t.id}/bracket`)
        .send({ seeding: 'manual' })
        .expect(201)
    ).body as Bracket;
    const matchOf = (round: number, position: number) =>
      bracket.rounds.find((r) => r.round === round)!.matches[position - 1];
    return { ...t, matchOf };
  };

  // The team in a slot of a match
  const teamOf = (match: Match, slot: 1 | 2) => match.slots[slot - 1].team!;

  const predict = (cookie: string, body: object) =>
    as(cookie).post('/predictions').send(body);

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

  describe('who can predict', () => {
    it('refuses anonymous visitors with 401', async () => {
      await request(server()).post('/predictions').expect(401);
      await request(server()).patch(`/predictions/${UNKNOWN_ID}`).expect(401);
      await request(server()).get('/me/predictions').expect(401);
    });

    it.each(['user', 'player', 'admin'] as const)(
      'lets a signed-in %s predict',
      async (role) => {
        const { matchOf } = await running(4);
        const match = matchOf(1, 1);
        const { cookie } = await signedInAs(app, role);
        await predict(cookie, {
          matchId: match.id,
          teamId: teamOf(match, 1).id,
        }).expect(201);
      },
    );
  });

  describe('create and list mine', () => {
    it('saves a pick with an exact score and shows it back', async () => {
      const { slug, matchOf } = await running(4);
      const match = matchOf(1, 1);
      const { cookie } = await signedInAs(app, 'user');

      const res = await predict(cookie, {
        matchId: match.id,
        teamId: teamOf(match, 2).id,
        score: [1, 3],
      }).expect(201);

      expect(res.body).toMatchObject({
        tournament: { slug },
        match: { id: match.id, label: 'Match 1', round: 1 },
        team: { id: teamOf(match, 2).id, name: 'Winter Cup Seed 4' },
        score: [1, 3],
        status: 'pending',
        points: 0,
        locked: false,
      });
    });

    it('lists only my predictions, in bracket order, per tournament if asked', async () => {
      const winter = await running(4);
      const spring = await running(2, 'Spring Cup');
      const me = await signedInAs(app, 'user');
      const someoneElse = await signedInAs(app, 'user');
      for (const match of [winter.matchOf(1, 2), winter.matchOf(1, 1)]) {
        await predict(me.cookie, {
          matchId: match.id,
          teamId: teamOf(match, 1).id,
        }).expect(201);
      }
      const springFinal = spring.matchOf(1, 1);
      await predict(me.cookie, {
        matchId: springFinal.id,
        teamId: teamOf(springFinal, 2).id,
      }).expect(201);
      await predict(someoneElse.cookie, {
        matchId: springFinal.id,
        teamId: teamOf(springFinal, 1).id,
      }).expect(201);

      const all = await as(me.cookie).get('/me/predictions').expect(200);
      expect(all.body).toHaveLength(3);
      const winterOnly = await as(me.cookie)
        .get(`/me/predictions?tournament=${winter.slug}`)
        .expect(200);
      expect(
        winterOnly.body.map((p: { match: { label: string } }) => p.match.label),
      ).toEqual(['Match 1', 'Match 2']);
      const byId = await as(me.cookie)
        .get(`/me/predictions?tournament=${spring.id}`)
        .expect(200);
      expect(byId.body.map((p: { team: { id: string } }) => p.team.id)).toEqual(
        [teamOf(springFinal, 2).id],
      );
    });

    it('keeps one prediction per user and match', async () => {
      const { matchOf } = await running(2);
      const match = matchOf(1, 1);
      const { cookie } = await signedInAs(app, 'user');
      await predict(cookie, {
        matchId: match.id,
        teamId: teamOf(match, 1).id,
      }).expect(201);
      const res = await predict(cookie, {
        matchId: match.id,
        teamId: teamOf(match, 2).id,
      }).expect(409);
      expect(res.body.message).toBe(
        'You already predicted Match 1: change that prediction instead',
      );
    });
  });

  describe('update', () => {
    it('changes the pick and the exact score, or removes the score', async () => {
      const { matchOf } = await running(2);
      const match = matchOf(1, 1);
      const { cookie } = await signedInAs(app, 'user');
      const created = (
        await predict(cookie, {
          matchId: match.id,
          teamId: teamOf(match, 1).id,
          score: [2, 0],
        }).expect(201)
      ).body as { id: string };

      const changed = await as(cookie)
        .patch(`/predictions/${created.id}`)
        .send({ teamId: teamOf(match, 2).id, score: [0, 2] })
        .expect(200);
      expect(changed.body).toMatchObject({
        team: { id: teamOf(match, 2).id },
        score: [0, 2],
      });

      const noScore = await as(cookie)
        .patch(`/predictions/${created.id}`)
        .send({ score: null })
        .expect(200);
      expect(noScore.body.score).toBeNull();
      expect(noScore.body.team.id).toBe(teamOf(match, 2).id);
    });

    it("cannot touch another user's prediction", async () => {
      const { matchOf } = await running(2);
      const match = matchOf(1, 1);
      const owner = await signedInAs(app, 'user');
      const other = await signedInAs(app, 'user');
      const created = (
        await predict(owner.cookie, {
          matchId: match.id,
          teamId: teamOf(match, 1).id,
        }).expect(201)
      ).body as { id: string };

      const res = await as(other.cookie)
        .patch(`/predictions/${created.id}`)
        .send({ teamId: teamOf(match, 2).id })
        .expect(404);
      expect(res.body.message).toBe(`No prediction ${created.id}`);
      const stored = await prisma.prediction.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(stored.userId).toBe(owner.user.id);
      // Nor see it in their list
      const list = await as(other.cookie).get('/me/predictions').expect(200);
      expect(list.body).toEqual([]);
    });
  });

  describe('lock, by the server clock', () => {
    it('refuses a new prediction or a change once the match has started', async () => {
      const { matchOf } = await running(2);
      const match = matchOf(1, 1);
      const { cookie } = await signedInAs(app, 'user');
      // Planned in an hour: still open
      await prisma.match.update({
        where: { id: match.id },
        data: { scheduledAt: new Date(Date.now() + 3_600_000) },
      });
      const created = (
        await predict(cookie, {
          matchId: match.id,
          teamId: teamOf(match, 1).id,
        }).expect(201)
      ).body as { id: string };

      // The match started a second ago
      await prisma.match.update({
        where: { id: match.id },
        data: { scheduledAt: new Date(Date.now() - 1000) },
      });
      const res = await as(cookie)
        .patch(`/predictions/${created.id}`)
        .send({ teamId: teamOf(match, 2).id })
        .expect(409);
      expect(res.body).toMatchObject({
        code: 'prediction_locked',
        reason: 'started',
        message: 'Match 1 has started: predictions are locked',
      });
      const late = await signedInAs(app, 'user');
      await predict(late.cookie, {
        matchId: match.id,
        teamId: teamOf(match, 1).id,
      }).expect(409);

      const list = await as(cookie).get('/me/predictions').expect(200);
      expect(list.body[0].locked).toBe(true);
    });

    it('refuses any change once the match has a result', async () => {
      const { matchOf } = await running(2);
      const match = matchOf(1, 1);
      const { cookie } = await signedInAs(app, 'user');
      const created = (
        await predict(cookie, {
          matchId: match.id,
          teamId: teamOf(match, 1).id,
        }).expect(201)
      ).body as { id: string };
      await as(admin)
        .post(`/matches/${match.id}/result`)
        .send({ scores: [3, 1], winnerSlot: 1 })
        .expect(201);

      const res = await as(cookie)
        .patch(`/predictions/${created.id}`)
        .send({ score: [3, 1] })
        .expect(409);
      expect(res.body).toMatchObject({
        reason: 'played',
        message: 'Match 1 is played: predictions are locked',
      });
    });

    it('refuses a match whose teams are not known, and a bye', async () => {
      const four = await running(4);
      const { cookie } = await signedInAs(app, 'user');
      const final = four.matchOf(2, 1);
      const unknown = await predict(cookie, {
        matchId: final.id,
        teamId: teamOf(four.matchOf(1, 1), 1).id,
      }).expect(409);
      expect(unknown.body.message).toBe(
        'Match 3 cannot be predicted yet: both teams are not known',
      );

      const three = await running(3, 'Spring Cup');
      const bye = three.matchOf(1, 1);
      const res = await predict(cookie, {
        matchId: bye.id,
        teamId: teamOf(bye, 1).id,
      }).expect(409);
      expect(res.body.reason).toBe('bye');
    });
  });

  describe('validation', () => {
    it('needs one of the two teams of the match', async () => {
      const { matchOf } = await running(4);
      const { cookie } = await signedInAs(app, 'user');
      const res = await predict(cookie, {
        matchId: matchOf(1, 1).id,
        teamId: teamOf(matchOf(1, 2), 1).id,
      }).expect(400);
      expect(res.body.errors).toEqual({
        teamId: [
          'teamId must be one of the two teams of Match 1: Winter Cup Seed 1 or Winter Cup Seed 4',
        ],
      });
    });

    it('checks the exact score against the pick', async () => {
      const { matchOf } = await running(2);
      const match = matchOf(1, 1);
      const { cookie } = await signedInAs(app, 'user');
      const tie = await predict(cookie, {
        matchId: match.id,
        teamId: teamOf(match, 1).id,
        score: [2, 2],
      }).expect(400);
      expect(tie.body.errors).toEqual({
        score: ['score cannot be a tie: a match always has a winner'],
      });
      const against = await predict(cookie, {
        matchId: match.id,
        teamId: teamOf(match, 1).id,
        score: [0, 2],
      }).expect(400);
      expect(against.body.errors).toEqual({
        score: ['score must give the picked team the higher score'],
      });
    });

    it('reports on teamId a kept score that no longer fits the new pick', async () => {
      const { matchOf } = await running(2);
      const match = matchOf(1, 1);
      const { cookie } = await signedInAs(app, 'user');
      const created = (
        await predict(cookie, {
          matchId: match.id,
          teamId: teamOf(match, 1).id,
          score: [2, 1],
        }).expect(201)
      ).body as { id: string };
      const res = await as(cookie)
        .patch(`/predictions/${created.id}`)
        .send({ teamId: teamOf(match, 2).id })
        .expect(400);
      expect(res.body.errors).toEqual({
        teamId: ['score must give the picked team the higher score'],
      });
    });

    it('explains malformed input and an unknown match', async () => {
      const { cookie } = await signedInAs(app, 'user');
      const malformed = await predict(cookie, {
        matchId: 'abc',
        teamId: UNKNOWN_ID,
        score: [1],
      }).expect(400);
      expect(malformed.body.errors).toEqual({
        matchId: ['matchId must be a valid UUID'],
        score: ['score must be two scores, slot 1 first'],
      });
      const unknown = await predict(cookie, {
        matchId: UNKNOWN_ID,
        teamId: UNKNOWN_ID,
      }).expect(400);
      expect(unknown.body.errors).toEqual({
        matchId: [`No match with id ${UNKNOWN_ID}`],
      });
      await as(cookie)
        .patch(`/predictions/${UNKNOWN_ID}`)
        .send({ score: null })
        .expect(404);
    });
  });
});
