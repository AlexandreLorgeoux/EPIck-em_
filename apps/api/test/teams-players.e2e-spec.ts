import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { UserRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase, signedInAs } from './test-app.js';

const UNKNOWN_ID = '0190a7c0-0000-7000-8000-000000000000';

describe('Teams and players API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Cookie header of a signed-in user per role, recreated after each reset
  let cookies: Record<UserRole, string>;
  const as = (role: UserRole) => ({
    get: (url: string) =>
      request(app.getHttpServer()).get(url).set('Cookie', cookies[role]),
    post: (url: string) =>
      request(app.getHttpServer()).post(url).set('Cookie', cookies[role]),
    patch: (url: string) =>
      request(app.getHttpServer()).patch(url).set('Cookie', cookies[role]),
    delete: (url: string) =>
      request(app.getHttpServer()).delete(url).set('Cookie', cookies[role]),
  });
  const admin = () => as('admin');

  const createPlayer = async (handle: string) =>
    (await admin().post('/players').send({ handle }).expect(201)).body as {
      id: string;
    };
  const createTeam = async (name: string, tag?: string) =>
    (await admin().post('/teams').send({ name, tag }).expect(201)).body as {
      id: string;
    };

  // Registers a team or a player in a new tournament, straight in the database
  const register = async (entry: { teamId?: string; playerId?: string }) => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const game = await prisma.game.create({
      data: {
        slug: `game-${suffix}`,
        name: 'Game',
        participantKind: 'team',
        maxTeamSize: 5,
      },
    });
    const owner = await prisma.user.create({
      data: {
        email: `owner-${suffix}@example.test`,
        displayName: 'Owner',
        role: 'admin',
      },
    });
    const tournament = await prisma.tournament.create({
      data: {
        gameId: game.id,
        ownerUserId: owner.id,
        name: 'Cup',
        slug: `cup-${suffix}`,
      },
    });
    await prisma.registration.create({
      data: { tournamentId: tournament.id, ...entry },
    });
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    cookies = {
      admin: (await signedInAs(app, 'admin')).cookie,
      player: (await signedInAs(app, 'player')).cookie,
      spectator: (await signedInAs(app, 'spectator')).cookie,
    };
  });

  afterAll(async () => {
    await app.close();
  });

  describe('permissions', () => {
    const routes: [method: 'get' | 'post' | 'patch' | 'delete', url: string][] =
      [
        ['post', '/players'],
        ['get', '/players'],
        ['get', `/players/${UNKNOWN_ID}`],
        ['patch', `/players/${UNKNOWN_ID}`],
        ['delete', `/players/${UNKNOWN_ID}`],
        ['post', '/teams'],
        ['get', '/teams'],
        ['get', `/teams/${UNKNOWN_ID}`],
        ['patch', `/teams/${UNKNOWN_ID}`],
        ['delete', `/teams/${UNKNOWN_ID}`],
        ['post', `/teams/${UNKNOWN_ID}/members`],
        ['delete', `/teams/${UNKNOWN_ID}/members/${UNKNOWN_ID}`],
      ];

    it.each(routes)(
      '%s %s rejects anonymous visitors with 401',
      async (method, url) => {
        await request(app.getHttpServer())[method](url).expect(401);
      },
    );

    it.each(routes)(
      '%s %s rejects spectators with 403',
      async (method, url) => {
        await as('spectator')[method](url).expect(403);
      },
    );

    it.each(routes)('%s %s rejects players with 403', async (method, url) => {
      await as('player')[method](url).expect(403);
    });

    it.each(routes)('%s %s lets admins through', async (method, url) => {
      const res = await admin()[method](url);
      expect([401, 403]).not.toContain(res.status);
    });
  });

  describe('players', () => {
    it('creates a player with a trimmed handle and no team', async () => {
      const res = await admin()
        .post('/players')
        .send({ handle: '  Zywoo ' })
        .expect(201);
      expect(res.body).toMatchObject({
        handle: 'Zywoo',
        userId: null,
        team: null,
      });
    });

    it('explains what is wrong with invalid input', async () => {
      const res = await admin()
        .post('/players')
        .send({ handle: 'a', nickname: 'x' })
        .expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          'property nickname should not exist',
          'handle must be between 2 and 32 characters',
        ]),
      );
    });

    it('rejects a link to an account that does not exist', async () => {
      const res = await admin()
        .post('/players')
        .send({ handle: 'Zywoo', userId: UNKNOWN_ID })
        .expect(400);
      expect(res.body.message).toBe(
        `userId ${UNKNOWN_ID} does not match any user`,
      );
    });

    it('links a player to an existing account', async () => {
      const user = await prisma.user.create({
        data: { email: 'zywoo@example.test', displayName: 'Zywoo' },
      });
      const res = await admin()
        .post('/players')
        .send({ handle: 'Zywoo', userId: user.id })
        .expect(201);
      expect(res.body.userId).toBe(user.id);
    });

    it('answers 400 for a malformed id and 404 for an unknown one', async () => {
      const bad = await admin().get('/players/not-a-uuid').expect(400);
      expect(bad.body.message).toBe('id must be a valid UUID');
      const missing = await admin().get(`/players/${UNKNOWN_ID}`).expect(404);
      expect(missing.body.message).toBe(`No player with id ${UNKNOWN_ID}`);
    });

    it('lists players by handle and filters with search', async () => {
      await createPlayer('Zywoo');
      await createPlayer('apEX');
      const all = await admin().get('/players').expect(200);
      expect(all.body.map((p: { handle: string }) => p.handle)).toEqual([
        'apEX',
        'Zywoo',
      ]);
      const found = await admin().get('/players?search=zy').expect(200);
      expect(found.body).toHaveLength(1);
    });

    it('updates a handle', async () => {
      const player = await createPlayer('Zywoo');
      const res = await admin()
        .patch(`/players/${player.id}`)
        .send({ handle: 'ZywOo' })
        .expect(200);
      expect(res.body.handle).toBe('ZywOo');
    });

    it('deletes a player and clears their captaincy', async () => {
      const team = await createTeam('Alpha');
      const player = await createPlayer('Zywoo');
      await admin()
        .post(`/teams/${team.id}/members`)
        .send({ playerId: player.id })
        .expect(201);
      await admin()
        .patch(`/teams/${team.id}`)
        .send({ captainPlayerId: player.id })
        .expect(200);

      await admin().delete(`/players/${player.id}`).expect(204);
      const res = await admin().get(`/teams/${team.id}`).expect(200);
      expect(res.body).toMatchObject({ captainPlayerId: null, members: [] });
    });

    it('refuses to delete a player registered in a tournament', async () => {
      const player = await createPlayer('Zywoo');
      await register({ playerId: player.id });
      const res = await admin().delete(`/players/${player.id}`).expect(409);
      expect(res.body.message).toContain('registered in 1 tournament(s)');
    });
  });

  describe('teams', () => {
    it('creates a team and finds it by name or tag', async () => {
      await createTeam('Alpha Esports', 'ALP');
      await createTeam('Bravo');
      const res = await admin().get('/teams?search=alp').expect(200);
      expect(res.body).toEqual([
        expect.objectContaining({
          name: 'Alpha Esports',
          tag: 'ALP',
          members: [],
        }),
      ]);
    });

    it('explains what is wrong with invalid input', async () => {
      const res = await admin()
        .post('/teams')
        .send({ name: '', tag: 'TOOLONGTAG' })
        .expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          'name must be between 2 and 64 characters',
          'tag must be between 1 and 8 characters',
        ]),
      );
    });

    it('adds a player, who then shows their team', async () => {
      const team = await createTeam('Alpha', 'ALP');
      const player = await createPlayer('Zywoo');
      const res = await admin()
        .post(`/teams/${team.id}/members`)
        .send({ playerId: player.id, role: 'AWPer' })
        .expect(201);
      expect(res.body.members).toEqual([
        expect.objectContaining({
          id: player.id,
          handle: 'Zywoo',
          role: 'AWPer',
          isSubstitute: false,
        }),
      ]);
      const playerRes = await admin().get(`/players/${player.id}`).expect(200);
      expect(playerRes.body.team).toMatchObject({
        id: team.id,
        name: 'Alpha',
        role: 'AWPer',
      });
    });

    it('keeps a player in one team at a time', async () => {
      const alpha = await createTeam('Alpha');
      const bravo = await createTeam('Bravo');
      const player = await createPlayer('Zywoo');
      await admin()
        .post(`/teams/${alpha.id}/members`)
        .send({ playerId: player.id })
        .expect(201);

      const again = await admin()
        .post(`/teams/${alpha.id}/members`)
        .send({ playerId: player.id })
        .expect(409);
      expect(again.body.message).toBe('Zywoo is already a member of this team');
      const other = await admin()
        .post(`/teams/${bravo.id}/members`)
        .send({ playerId: player.id })
        .expect(409);
      expect(other.body.message).toBe(
        'Zywoo already belongs to Alpha: remove them from that team first',
      );
    });

    it('only accepts a current member as captain', async () => {
      const team = await createTeam('Alpha');
      const player = await createPlayer('Zywoo');
      const refused = await admin()
        .patch(`/teams/${team.id}`)
        .send({ captainPlayerId: player.id })
        .expect(400);
      expect(refused.body.message).toContain(
        'must be a current member of the team',
      );

      await admin()
        .post(`/teams/${team.id}/members`)
        .send({ playerId: player.id })
        .expect(201);
      const res = await admin()
        .patch(`/teams/${team.id}`)
        .send({ captainPlayerId: player.id })
        .expect(200);
      expect(res.body.captainPlayerId).toBe(player.id);
    });

    it('removes a member but keeps the membership as history', async () => {
      const team = await createTeam('Alpha');
      const player = await createPlayer('Zywoo');
      await admin()
        .post(`/teams/${team.id}/members`)
        .send({ playerId: player.id })
        .expect(201);
      await admin()
        .patch(`/teams/${team.id}`)
        .send({ captainPlayerId: player.id })
        .expect(200);

      const res = await admin()
        .delete(`/teams/${team.id}/members/${player.id}`)
        .expect(200);
      expect(res.body).toMatchObject({ captainPlayerId: null, members: [] });
      const history = await prisma.teamMember.findMany({
        where: { playerId: player.id },
      });
      expect(history).toHaveLength(1);
      expect(history[0].leftOn).not.toBeNull();

      // Joining back the same day reopens the membership
      await admin()
        .post(`/teams/${team.id}/members`)
        .send({ playerId: player.id })
        .expect(201);
    });

    it('answers 404 when removing someone who is not a member', async () => {
      const team = await createTeam('Alpha');
      const player = await createPlayer('Zywoo');
      await admin()
        .delete(`/teams/${team.id}/members/${player.id}`)
        .expect(404);
    });

    it('deletes a team with its memberships', async () => {
      const team = await createTeam('Alpha');
      const player = await createPlayer('Zywoo');
      await admin()
        .post(`/teams/${team.id}/members`)
        .send({ playerId: player.id })
        .expect(201);

      await admin().delete(`/teams/${team.id}`).expect(204);
      await admin().get(`/teams/${team.id}`).expect(404);
      const playerRes = await admin().get(`/players/${player.id}`).expect(200);
      expect(playerRes.body.team).toBeNull();
    });

    it('refuses to delete a team registered in a tournament', async () => {
      const team = await createTeam('Alpha');
      await register({ teamId: team.id });
      const res = await admin().delete(`/teams/${team.id}`).expect(409);
      expect(res.body.message).toContain('registered in 1 tournament(s)');
    });
  });
});
