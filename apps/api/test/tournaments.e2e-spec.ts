import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { UserRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase, signedInAs } from './test-app.js';

const UNKNOWN_ID = '0190a7c0-0000-7000-8000-000000000000';

type Tournament = { id: string; slug: string; status: string };

describe('Tournament API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookies: Record<UserRole, string>;

  const server = () => app.getHttpServer();
  const as = (role: UserRole) => ({
    get: (url: string) =>
      request(server()).get(url).set('Cookie', cookies[role]),
    post: (url: string) =>
      request(server()).post(url).set('Cookie', cookies[role]),
    patch: (url: string) =>
      request(server()).patch(url).set('Cookie', cookies[role]),
    delete: (url: string) =>
      request(server()).delete(url).set('Cookie', cookies[role]),
  });
  const admin = () => as('admin');

  const create = async (body: object = {}) =>
    (
      await admin()
        .post('/tournaments')
        .send({ name: 'Winter Cup', game: 'Rocket League', ...body })
        .expect(201)
    ).body as Tournament;

  const started = async (body: object = {}) => {
    const t = await create(body);
    await admin().post(`/tournaments/${t.id}/start`).expect(200);
    return t;
  };

  // A running tournament whose only match is decided, written the way the
  // recalculation job writes derived rows
  const finished = async () => {
    const t = await started({ name: 'Finished Cup' });
    const stage = await prisma.stage.create({
      data: {
        tournamentId: t.id,
        position: 1,
        name: 'Main',
        format: 'single_elim',
      },
    });
    const match = await prisma.match.create({
      data: { stageId: stage.id, bracketRound: 1, position: 1, label: 'Final' },
    });
    await prisma.$transaction([
      prisma.$executeRaw`SELECT set_config('app.recompute', 'on', true)`,
      prisma.matchOutcome.create({
        data: { matchId: match.id, state: 'decided' },
      }),
    ]);
    return t;
  };

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
    const adminRoutes: [method: 'post' | 'patch' | 'delete', url: string][] = [
      ['post', '/tournaments'],
      ['patch', `/tournaments/${UNKNOWN_ID}`],
      ['delete', `/tournaments/${UNKNOWN_ID}`],
      ['post', `/tournaments/${UNKNOWN_ID}/start`],
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

    it('lets anyone list and read tournaments that have started', async () => {
      const t = await started();
      await request(server()).get('/tournaments').expect(200);
      await request(server()).get(`/tournaments/${t.slug}`).expect(200);
      await as('user').get(`/tournaments/${t.id}`).expect(200);
    });

    it('hides drafts from everyone but admins', async () => {
      const draft = await create({ name: 'Secret Cup' });
      const lists = await Promise.all([
        request(server()).get('/tournaments').expect(200),
        as('user').get('/tournaments').expect(200),
        as('player').get('/tournaments').expect(200),
      ]);
      for (const list of lists) expect(list.body).toEqual([]);
      await request(server()).get(`/tournaments/${draft.id}`).expect(404);
      await as('player').get(`/tournaments/${draft.slug}`).expect(404);

      const adminList = await admin().get('/tournaments').expect(200);
      expect(adminList.body).toHaveLength(1);
      await admin().get(`/tournaments/${draft.slug}`).expect(200);
    });
  });

  describe('create', () => {
    it('creates a draft with its game, slug and owner', async () => {
      const res = await admin()
        .post('/tournaments')
        .send({
          name: "  Coupe d'Hiver 2026 ",
          game: 'Rocket League',
          description: 'Bracket 3v3',
          startsAt: '2026-12-05T14:00:00Z',
          endsAt: '2026-12-06T20:00:00Z',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        name: "Coupe d'Hiver 2026",
        slug: 'coupe-d-hiver-2026',
        game: { name: 'Rocket League' },
        description: 'Bracket 3v3',
        startsAt: '2026-12-05T14:00:00.000Z',
        endsAt: '2026-12-06T20:00:00.000Z',
        status: 'draft',
        owner: { displayName: 'admin' },
      });
    });

    it('reuses a game that already exists, whatever its case', async () => {
      const a = await create({ game: 'Rocket League' });
      const b = await create({ name: 'Spring Cup', game: 'rocket league' });
      const res = await admin().get(`/tournaments/${b.id}`).expect(200);
      const first = await admin().get(`/tournaments/${a.id}`).expect(200);
      expect(res.body.game.id).toBe(first.body.game.id);
      expect(await prisma.game.count()).toBe(1);
    });

    it('gives each tournament its own slug', async () => {
      const a = await create();
      const b = await create();
      expect([a.slug, b.slug]).toEqual(['winter-cup', 'winter-cup-2']);
    });

    it('explains what is wrong with invalid input', async () => {
      const res = await admin()
        .post('/tournaments')
        .send({ name: 'WC', startsAt: 'next friday' })
        .expect(400);
      expect(res.body.errors).toEqual({
        name: ['name must be between 3 and 80 characters'],
        game: [
          'game must be between 2 and 60 characters',
          'game must be a string',
        ],
        startsAt: ['startsAt must be a date such as 2026-12-05T14:00:00Z'],
      });
    });

    it('refuses an end before the start, on the endsAt field', async () => {
      const res = await admin()
        .post('/tournaments')
        .send({
          name: 'Winter Cup',
          game: 'Rocket League',
          startsAt: '2026-12-06T00:00:00Z',
          endsAt: '2026-12-05T00:00:00Z',
        })
        .expect(400);
      expect(res.body.errors).toEqual({
        endsAt: ['endsAt must be after startsAt'],
      });
    });
  });

  describe('list and get', () => {
    it('lists by start date and filters by status', async () => {
      await started({ name: 'Later Cup', startsAt: '2026-12-20T00:00:00Z' });
      await started({ name: 'Sooner Cup', startsAt: '2026-12-01T00:00:00Z' });
      await create({ name: 'Draft Cup' });
      await finished();

      const all = await admin().get('/tournaments').expect(200);
      expect(all.body.map((t: { name: string }) => t.name)).toEqual([
        'Sooner Cup',
        'Later Cup',
        'Draft Cup',
        'Finished Cup',
      ]);
      const running = await admin()
        .get('/tournaments?status=running')
        .expect(200);
      expect(running.body.map((t: { name: string }) => t.name)).toEqual([
        'Sooner Cup',
        'Later Cup',
      ]);
      const done = await request(server())
        .get('/tournaments?status=finished')
        .expect(200);
      expect(done.body.map((t: { status: string }) => t.status)).toEqual([
        'finished',
      ]);
    });

    it('explains an unknown status filter', async () => {
      const res = await request(server())
        .get('/tournaments?status=paused')
        .expect(400);
      expect(res.body.errors).toEqual({
        status: ['status must be one of: draft, running, finished'],
      });
    });

    it('answers 404 for an unknown id or slug', async () => {
      await admin().get(`/tournaments/${UNKNOWN_ID}`).expect(404);
      await request(server()).get('/tournaments/no-such-cup').expect(404);
    });
  });

  describe('per status', () => {
    it('is running once started, and finished when every match is decided', async () => {
      const draft = await create();
      expect(draft.status).toBe('draft');
      const run = await admin()
        .post(`/tournaments/${draft.id}/start`)
        .expect(200);
      expect(run.body.status).toBe('running');
      const done = await finished();
      const res = await admin().get(`/tournaments/${done.id}`).expect(200);
      expect(res.body.status).toBe('finished');
    });

    it('edits a draft, and follows a new name in its slug', async () => {
      const t = await create();
      const res = await admin()
        .patch(`/tournaments/${t.id}`)
        .send({ name: 'Snow Cup', game: 'Trackmania', description: null })
        .expect(200);
      expect(res.body).toMatchObject({
        name: 'Snow Cup',
        slug: 'snow-cup',
        game: { name: 'Trackmania' },
        description: null,
        status: 'draft',
      });
    });

    it('checks the dates against the stored ones on edit', async () => {
      const t = await create({ startsAt: '2026-12-05T00:00:00Z' });
      const res = await admin()
        .patch(`/tournaments/${t.id}`)
        .send({ endsAt: '2026-12-01T00:00:00Z' })
        .expect(400);
      expect(res.body.errors).toEqual({
        endsAt: ['endsAt must be after startsAt'],
      });
    });

    it('deletes a draft with its registrations', async () => {
      const t = await create();
      const team = await prisma.team.create({ data: { name: 'Alpha' } });
      await prisma.registration.create({
        data: { tournamentId: t.id, teamId: team.id },
      });

      await admin().delete(`/tournaments/${t.id}`).expect(204);
      await admin().get(`/tournaments/${t.id}`).expect(404);
      expect(await prisma.registration.count()).toBe(0);
    });

    it.each([
      ['running', started],
      ['finished', finished],
    ] as const)(
      'refuses to edit, delete or restart a %s tournament',
      async (status, make) => {
        const t = await make();
        const edit = await admin()
          .patch(`/tournaments/${t.id}`)
          .send({ name: 'New Name' })
          .expect(409);
        expect(edit.body.message).toBe(
          `This tournament is ${status}: only a draft tournament can be edited`,
        );
        const del = await admin().delete(`/tournaments/${t.id}`).expect(409);
        expect(del.body.message).toBe(
          `This tournament is ${status}: only a draft tournament can be deleted`,
        );
        await admin().post(`/tournaments/${t.id}/start`).expect(409);
        await admin().get(`/tournaments/${t.id}`).expect(200);
      },
    );
  });
});
