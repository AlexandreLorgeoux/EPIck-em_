import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase, signedInAs } from './test-app.js';

type Slot = { team: { id: string } | null };
type Match = { id: string; slots: Slot[] };
type Bracket = { rounds: { round: number; matches: Match[] }[] };
type Entry = {
  rank: number;
  user: { id: string; displayName: string };
  points: number;
  correctPicks: number;
};
type ServerEvent = {
  type: string;
  id?: string;
  retry?: number;
  data: Record<string, unknown>;
};

// Reads server-sent events from a real connection, one at a time
async function openStream(url: string, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const res = await fetch(url, { headers, signal: controller.signal });
  const queue: ServerEvent[] = [];
  const waiting: ((event: ServerEvent) => void)[] = [];
  if (res.ok && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    void (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) return;
          buffer += decoder.decode(value, { stream: true });
          let end: number;
          while ((end = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            const event: ServerEvent = { type: 'message', data: {} };
            let data = '';
            for (const line of frame.split('\n')) {
              const [field, ...rest] = line.split(':');
              const value = rest.join(':').replace(/^ /, '');
              if (field === 'event') event.type = value;
              if (field === 'id') event.id = value;
              if (field === 'retry') event.retry = Number(value);
              if (field === 'data') data += value;
            }
            // A comment-only frame (keep-alive) has no data
            if (!data) continue;
            event.data = JSON.parse(data) as Record<string, unknown>;
            const next = waiting.shift();
            if (next) next(event);
            else queue.push(event);
          }
        }
      } catch {
        // Aborted by close()
      }
    })();
  }
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    // The next event, failing after `ms`
    next: (ms = 1000) =>
      new Promise<ServerEvent>((resolve, reject) => {
        const ready = queue.shift();
        if (ready) return resolve(ready);
        const timer = setTimeout(
          () => reject(new Error(`No event within ${ms} ms`)),
          ms,
        );
        waiting.push((event) => {
          clearTimeout(timer);
          resolve(event);
        });
      }),
    close: () => controller.abort(),
  };
}

describe('Leaderboard and live events (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: string;
  let baseUrl: string;

  const server = () => app.getHttpServer();
  const as = (cookie: string) => ({
    get: (url: string) => request(server()).get(url).set('Cookie', cookie),
    post: (url: string) => request(server()).post(url).set('Cookie', cookie),
    put: (url: string) => request(server()).put(url).set('Cookie', cookie),
  });

  // 4 teams seeded in order: Match 1 is Seed 1 against Seed 4, Match 2
  // Seed 2 against Seed 3
  const running = async (name = 'Winter Cup') => {
    const t = (
      await as(admin)
        .post('/tournaments')
        .send({ name, game: 'Rocket League' })
        .expect(201)
    ).body as { id: string };
    const teamIds: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const team = await prisma.team.create({
        data: { name: `${name} Seed ${i}` },
      });
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
    const [match1, match2] = bracket.rounds[0].matches;
    return { id: t.id, teamIds, match1, match2 };
  };

  const user = (displayName: string) =>
    signedInAs(app, 'user').then(async (signed) => {
      await prisma.user.update({
        where: { id: signed.user.id },
        data: { displayName },
      });
      return signed;
    });

  const predict = (
    cookie: string,
    matchId: string,
    teamId: string,
    score?: number[],
  ) =>
    as(cookie)
      .post('/predictions')
      .send({ matchId, teamId, score })
      .expect(201);

  const enter = (matchId: string, scores: number[], winnerSlot: number) =>
    as(admin)
      .post(`/matches/${matchId}/result`)
      .send({ scores, winnerSlot })
      .expect(201);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    // A real server, so the event stream is read as a browser reads it
    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = (await signedInAs(app, 'admin')).cookie;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('leaderboard', () => {
    // Scoring 2 / 2 / 0: an exact score and two plain correct picks are
    // both worth 4, so ties are broken by correct picks, then by time
    const played = async () => {
      const t = await running();
      await as(admin)
        .put(`/tournaments/${t.id}/scoring`)
        .send({ pointsCorrectPick: 2, exactScoreBonus: 2, roundIncrement: 0 })
        .expect(200);
      const [seed1, seed2, , seed4] = t.teamIds;
      const early = await user('Early');
      await predict(early.cookie, t.match2.id, seed2);
      // Exact predicts before Two picks: only the correct picks can put
      // Two picks first
      const exact = await user('Exact');
      await predict(exact.cookie, t.match1.id, seed1, [3, 1]);
      const twoPicks = await user('Two picks');
      await predict(twoPicks.cookie, t.match1.id, seed1);
      await predict(twoPicks.cookie, t.match2.id, seed2);
      const late = await user('Late');
      await predict(late.cookie, t.match1.id, seed1);
      const wrong = await user('Wrong');
      await predict(wrong.cookie, t.match1.id, seed4);
      await enter(t.match1.id, [3, 1], 1);
      await enter(t.match2.id, [2, 0], 1);
      return { ...t, late };
    };

    it('ranks by points, then correct picks, then who predicted first', async () => {
      const { id } = await played();
      const res = await request(server())
        .get(`/tournaments/${id}/leaderboard`)
        .expect(200);
      expect(
        (res.body.entries as Entry[]).map((e) => [
          e.rank,
          e.user.displayName,
          e.points,
          e.correctPicks,
        ]),
      ).toEqual([
        [1, 'Two picks', 4, 2],
        [2, 'Exact', 4, 1],
        [3, 'Early', 2, 1],
        [4, 'Late', 2, 1],
        [5, 'Wrong', 0, 0],
      ]);
      expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 5 });
      // Never an e-mail address: only what the ranking shows
      expect(Object.keys(res.body.entries[0].user)).toEqual([
        'id',
        'displayName',
      ]);
    });

    it('pages through the ranking, with my own row wherever it is', async () => {
      const { id, late } = await played();
      const page2 = await request(server())
        .get(`/tournaments/${id}/leaderboard?page=2&pageSize=2`)
        .expect(200);
      expect(
        (page2.body.entries as Entry[]).map((e) => e.user.displayName),
      ).toEqual(['Early', 'Late']);
      expect(page2.body.me).toBeNull();

      const mine = await as(late.cookie)
        .get(`/tournaments/${id}/leaderboard?pageSize=1`)
        .expect(200);
      expect(mine.body.entries).toHaveLength(1);
      expect(mine.body.me).toMatchObject({
        rank: 4,
        user: { displayName: 'Late' },
        points: 2,
      });
    });

    it('is empty before anyone predicts, and hidden for a draft', async () => {
      const { id } = await running();
      const empty = await request(server())
        .get(`/tournaments/${id}/leaderboard`)
        .expect(200);
      expect(empty.body).toMatchObject({ total: 0, entries: [], me: null });

      const draft = (
        await as(admin)
          .post('/tournaments')
          .send({ name: 'Draft Cup', game: 'Rocket League' })
          .expect(201)
      ).body as { id: string };
      await request(server())
        .get(`/tournaments/${draft.id}/leaderboard`)
        .expect(404);
    });

    it('explains a wrong page', async () => {
      const { id } = await running();
      const res = await request(server())
        .get(`/tournaments/${id}/leaderboard?page=0&pageSize=500`)
        .expect(400);
      expect(res.body.errors).toEqual({
        page: ['page must be 1 or more'],
        pageSize: ['pageSize must be 100 or less'],
      });
    });
  });

  describe('live events', () => {
    const streams: { close: () => void }[] = [];
    const open = async (id: string, headers?: Record<string, string>) => {
      const stream = await openStream(
        `${baseUrl}/tournaments/${id}/events`,
        headers,
      );
      streams.push(stream);
      return stream;
    };

    afterEach(() => {
      while (streams.length) streams.pop()!.close();
    });

    it('starts with a sync event carrying the version', async () => {
      const { id } = await running();
      const stream = await open(id);
      expect(stream.status).toBe(200);
      expect(stream.contentType).toContain('text/event-stream');
      expect(await stream.next()).toEqual({
        type: 'sync',
        id: '0',
        retry: 3000,
        data: { version: '0', missed: false },
      });
    });

    it('pushes the result, the bracket and the ranking within a second', async () => {
      const { id, teamIds, match1 } = await running();
      const fan = await user('Fan');
      await predict(fan.cookie, match1.id, teamIds[0]);
      const stream = await open(id);
      await stream.next(); // sync

      const sent = Date.now();
      await enter(match1.id, [3, 1], 1);
      const events = [
        await stream.next(),
        await stream.next(),
        await stream.next(),
      ];
      expect(Date.now() - sent).toBeLessThan(1000);

      const version = String(
        (await prisma.scoreAuditLog.findFirstOrThrow()).id,
      );
      expect(events).toEqual([
        {
          type: 'match-result',
          id: version,
          data: { matchId: match1.id, version },
        },
        { type: 'bracket', id: version, data: { version } },
        { type: 'leaderboard', id: version, data: { version } },
      ]);
      // The refetched ranking is that version, with the new points
      const board = await request(server())
        .get(`/tournaments/${id}/leaderboard`)
        .expect(200);
      expect(board.body.version).toBe(version);
      expect(board.body.entries[0]).toMatchObject({ points: 3 });
    });

    it('pushes the ranking again when the scoring changes', async () => {
      const { id } = await running();
      const stream = await open(id);
      await stream.next(); // sync
      await as(admin)
        .put(`/tournaments/${id}/scoring`)
        .send({ pointsCorrectPick: 5, exactScoreBonus: 1, roundIncrement: 0 })
        .expect(200);
      expect((await stream.next()).type).toBe('leaderboard');
    });

    it('only sends the changes of its own tournament', async () => {
      const winter = await running();
      const spring = await running('Spring Cup');
      const stream = await open(winter.id);
      await stream.next(); // sync
      await enter(spring.match1.id, [1, 0], 1);
      await enter(winter.match1.id, [1, 0], 1);
      expect(await stream.next()).toMatchObject({
        type: 'match-result',
        data: { matchId: winter.match1.id },
      });
    });

    it('tells a client that reconnects whether it missed changes', async () => {
      const { id, match1 } = await running();
      const first = await open(id);
      const { id: before } = await first.next();
      first.close();

      // A result is entered while the client is away
      await enter(match1.id, [3, 1], 1);

      const behind = await open(id, { 'Last-Event-ID': before! });
      const sync = await behind.next();
      expect(sync).toMatchObject({ type: 'sync', data: { missed: true } });

      const current = await open(id, { 'Last-Event-ID': sync.id! });
      expect(await current.next()).toMatchObject({
        type: 'sync',
        data: { missed: false },
      });
    });

    it('answers 404 for a draft, before opening any stream', async () => {
      const draft = (
        await as(admin)
          .post('/tournaments')
          .send({ name: 'Draft Cup', game: 'Rocket League' })
          .expect(201)
      ).body as { id: string };
      const stream = await open(draft.id);
      expect(stream.status).toBe(404);
    });
  });
});
