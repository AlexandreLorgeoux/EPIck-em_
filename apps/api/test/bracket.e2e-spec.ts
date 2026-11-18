import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { UserRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase, signedInAs } from './test-app.js';

const UNKNOWN_ID = '0190a7c0-0000-7000-8000-000000000000';

type Slot = {
  state: string;
  seed: number | null;
  team: { name: string } | null;
  winner: boolean;
};
type Match = { label: string; state: string; slots: Slot[] };
type Bracket = {
  stage: { seeding: string };
  rounds: { round: number; matches: Match[] }[];
};

describe('Teams and bracket (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookies: Record<UserRole, string>;

  const server = () => app.getHttpServer();
  const as = (role: UserRole) => ({
    get: (url: string) =>
      request(server()).get(url).set('Cookie', cookies[role]),
    post: (url: string) =>
      request(server()).post(url).set('Cookie', cookies[role]),
    put: (url: string) =>
      request(server()).put(url).set('Cookie', cookies[role]),
    delete: (url: string) =>
      request(server()).delete(url).set('Cookie', cookies[role]),
  });
  const admin = () => as('admin');

  const tournament = async () =>
    (
      await admin()
        .post('/tournaments')
        .send({ name: 'Winter Cup', game: 'Rocket League' })
        .expect(201)
    ).body as { id: string };

  // Creates teams named after their intended seed, and adds them
  const withTeams = async (count: number) => {
    const t = await tournament();
    const teams: { id: string; name: string }[] = [];
    for (let i = 1; i <= count; i++) {
      const team = await prisma.team.create({ data: { name: `Seed ${i}` } });
      await admin()
        .post(`/tournaments/${t.id}/teams`)
        .send({ teamId: team.id })
        .expect(201);
      teams.push(team);
    }
    return { id: t.id, teams };
  };

  const generate = (id: string, seeding: 'manual' | 'auto') =>
    admin().post(`/tournaments/${id}/bracket`).send({ seeding });

  // "Seed 1 vs Seed 4" per match of a round, "bye" for a missing opponent
  const pairs = (bracket: Bracket, round: number) =>
    bracket.rounds
      .find((r) => r.round === round)!
      .matches.map((m) =>
        m.slots
          .map((s) => (s.state === 'bye' ? 'bye' : (s.team?.name ?? 'open')))
          .join(' vs '),
      );

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
    const adminRoutes: [method: 'post' | 'put' | 'delete', url: string][] = [
      ['post', `/tournaments/${UNKNOWN_ID}/teams`],
      ['delete', `/tournaments/${UNKNOWN_ID}/teams/${UNKNOWN_ID}`],
      ['put', `/tournaments/${UNKNOWN_ID}/seeding`],
      ['post', `/tournaments/${UNKNOWN_ID}/bracket`],
    ];

    it.each(adminRoutes)(
      '%s %s rejects anonymous visitors with 401',
      async (method, url) => {
        await request(server())[method](url).expect(401);
      },
    );

    it.each(adminRoutes)(
      '%s %s rejects users and players with 403',
      async (method, url) => {
        await as('user')[method](url).expect(403);
        await as('player')[method](url).expect(403);
      },
    );

    it.each(adminRoutes)('%s %s lets admins through', async (method, url) => {
      const res = await admin()[method](url);
      expect([401, 403]).not.toContain(res.status);
    });

    it('shows the teams and bracket of a running tournament to anyone', async () => {
      const { id } = await withTeams(2);
      await generate(id, 'auto').expect(201);
      await request(server()).get(`/tournaments/${id}/teams`).expect(200);
      await request(server()).get(`/tournaments/${id}/bracket`).expect(200);
    });

    it('hides the teams of a draft from everyone but admins', async () => {
      const { id } = await withTeams(2);
      await request(server()).get(`/tournaments/${id}/teams`).expect(404);
      await as('player').get(`/tournaments/${id}/teams`).expect(404);
      await admin().get(`/tournaments/${id}/teams`).expect(200);
    });
  });

  describe('teams of a draft', () => {
    it('adds and lists teams, then removes one', async () => {
      const { id, teams } = await withTeams(2);
      const list = await admin().get(`/tournaments/${id}/teams`).expect(200);
      expect(list.body).toEqual([
        { id: teams[0].id, name: 'Seed 1', tag: null, seed: null },
        { id: teams[1].id, name: 'Seed 2', tag: null, seed: null },
      ]);

      await admin()
        .delete(`/tournaments/${id}/teams/${teams[0].id}`)
        .expect(204);
      const after = await admin().get(`/tournaments/${id}/teams`).expect(200);
      expect(after.body.map((t: { name: string }) => t.name)).toEqual([
        'Seed 2',
      ]);
    });

    it('refuses the same team twice', async () => {
      const { id, teams } = await withTeams(1);
      const res = await admin()
        .post(`/tournaments/${id}/teams`)
        .send({ teamId: teams[0].id })
        .expect(409);
      expect(res.body.message).toBe('Seed 1 is already in this tournament');
    });

    it('explains an unknown team, on the teamId field', async () => {
      const t = await tournament();
      const res = await admin()
        .post(`/tournaments/${t.id}/teams`)
        .send({ teamId: UNKNOWN_ID })
        .expect(400);
      expect(res.body.errors).toEqual({
        teamId: [`No team with id ${UNKNOWN_ID}`],
      });
    });

    it('answers 404 when removing a team that is not in the tournament', async () => {
      const t = await tournament();
      await admin()
        .delete(`/tournaments/${t.id}/teams/${UNKNOWN_ID}`)
        .expect(404);
    });
  });

  describe('seeding', () => {
    it('sets the seeds from an ordered list of every team', async () => {
      const { id, teams } = await withTeams(3);
      const res = await admin()
        .put(`/tournaments/${id}/seeding`)
        .send({ teamIds: [teams[2].id, teams[0].id, teams[1].id] })
        .expect(200);
      expect(
        res.body.map((t: { name: string; seed: number }) => [t.seed, t.name]),
      ).toEqual([
        [1, 'Seed 3'],
        [2, 'Seed 1'],
        [3, 'Seed 2'],
      ]);
    });

    it('refuses a list that misses a team or names an unknown one', async () => {
      const { id, teams } = await withTeams(3);
      const res = await admin()
        .put(`/tournaments/${id}/seeding`)
        .send({ teamIds: [teams[0].id, UNKNOWN_ID] })
        .expect(400);
      expect(res.body.errors).toEqual({
        teamIds: [
          'teamIds must list every team of the tournament once: 1 not in it, 2 missing',
        ],
      });
    });

    it('refuses a team listed twice', async () => {
      const { id, teams } = await withTeams(2);
      const res = await admin()
        .put(`/tournaments/${id}/seeding`)
        .send({ teamIds: [teams[0].id, teams[0].id] })
        .expect(400);
      expect(res.body.errors).toEqual({
        teamIds: ['teamIds must not list a team twice'],
      });
    });
  });

  describe('generating the bracket', () => {
    it('pairs manual seeds so the best meet last, and starts the tournament', async () => {
      const { id, teams } = await withTeams(4);
      await admin()
        .put(`/tournaments/${id}/seeding`)
        .send({ teamIds: teams.map((t) => t.id) })
        .expect(200);

      const res = await generate(id, 'manual').expect(201);

      expect(res.body.stage.seeding).toBe('manual');
      expect(pairs(res.body, 1)).toEqual([
        'Seed 1 vs Seed 4',
        'Seed 2 vs Seed 3',
      ]);
      expect(pairs(res.body, 2)).toEqual(['open vs open']);
      const t = await admin().get(`/tournaments/${id}`).expect(200);
      expect(t.body.status).toBe('running');
    });

    it('gives byes to the top seeds and moves them to the next round', async () => {
      const { id, teams } = await withTeams(3);
      await admin()
        .put(`/tournaments/${id}/seeding`)
        .send({ teamIds: teams.map((t) => t.id) })
        .expect(200);

      const res = await generate(id, 'manual').expect(201);

      expect(pairs(res.body, 1)).toEqual(['Seed 1 vs bye', 'Seed 2 vs Seed 3']);
      const byeMatch = res.body.rounds[0].matches[0] as Match;
      expect(byeMatch.state).toBe('decided');
      expect(byeMatch.slots[0].winner).toBe(true);
      expect(pairs(res.body, 2)).toEqual(['Seed 1 vs open']);
    });

    it('draws random seeds 1 to n with automatic seeding', async () => {
      const { id } = await withTeams(6);
      const res = await generate(id, 'auto').expect(201);

      expect(res.body.stage.seeding).toBe('auto');
      expect(
        res.body.rounds.map((r: { matches: unknown[] }) => r.matches.length),
      ).toEqual([4, 2, 1]);
      const teams = await admin().get(`/tournaments/${id}/teams`).expect(200);
      expect(teams.body.map((t: { seed: number }) => t.seed)).toEqual([
        1, 2, 3, 4, 5, 6,
      ]);
      // 6 teams in 8 places: two byes
      const round1 = pairs(res.body, 1).join(' ');
      expect(round1.match(/bye/g)).toHaveLength(2);
    });

    it('writes the derived bracket state for every slot and match', async () => {
      const { id } = await withTeams(5);
      await generate(id, 'auto').expect(201);
      // 5 teams: 8 places, 7 matches, 14 slots
      expect(await prisma.match.count()).toBe(7);
      expect(await prisma.slotAssignment.count()).toBe(14);
      expect(await prisma.matchOutcome.count()).toBe(7);
    });

    it('needs at least two teams', async () => {
      const { id } = await withTeams(1);
      const res = await generate(id, 'auto').expect(409);
      expect(res.body.message).toBe(
        'A bracket needs at least 2 teams: this tournament has 1',
      );
    });

    it('needs complete seeds for manual seeding', async () => {
      const { id } = await withTeams(2);
      const res = await generate(id, 'manual').expect(400);
      expect(res.body.errors).toEqual({
        seeding: [
          'Every team needs a different seed from 1 to 2: set them with PUT /tournaments/:id/seeding, or choose auto',
        ],
      });
      // Nothing was saved
      expect(await prisma.stage.count()).toBe(0);
    });

    it('explains an unknown seeding mode', async () => {
      const t = await tournament();
      const res = await admin()
        .post(`/tournaments/${t.id}/bracket`)
        .send({ seeding: 'by-rank' })
        .expect(400);
      expect(res.body.errors).toEqual({
        seeding: ['seeding must be manual or auto'],
      });
    });

    it('freezes the teams and the bracket once generated', async () => {
      const { id, teams } = await withTeams(2);
      await generate(id, 'auto').expect(201);

      const again = await generate(id, 'auto').expect(409);
      expect(again.body.message).toBe(
        'This tournament is running: only a draft tournament can be started',
      );
      const extra = await prisma.team.create({ data: { name: 'Late' } });
      await admin()
        .post(`/tournaments/${id}/teams`)
        .send({ teamId: extra.id })
        .expect(409);
      await admin()
        .delete(`/tournaments/${id}/teams/${teams[0].id}`)
        .expect(409);
      await admin()
        .put(`/tournaments/${id}/seeding`)
        .send({ teamIds: teams.map((t) => t.id) })
        .expect(409);
    });

    it('answers 404 for the bracket of a tournament that has none yet', async () => {
      const t = await tournament();
      const res = await admin().get(`/tournaments/${t.id}/bracket`).expect(404);
      expect(res.body.message).toBe('This tournament has no bracket yet');
    });
  });
});
