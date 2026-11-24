import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { DEMO_SLUG, seedDemoTournament } from '../src/seed/demo.js';
import { createTestApp, resetDatabase, signedInAs } from './test-app.js';

// The tables of the predictions (ticket #56) and the rules the database
// enforces on them, checked on the real database
describe('Predictions schema (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // A prediction of the demo, with its user, match and the other team
  const aPrediction = async () => {
    const prediction = await prisma.prediction.findFirstOrThrow({
      include: {
        match: {
          include: { slots: { include: { assignment: true } } },
        },
      },
    });
    const other = prediction.match.slots
      .map((s) => s.assignment!.registrationId!)
      .find((id) => id !== prediction.pickedRegistrationId)!;
    return { prediction, other };
  };

  // Writes as the recalculation does, inside its transaction
  const asRecompute = <T>(
    write: (tx: Prisma.TransactionClient) => Promise<T>,
  ) =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.recompute', 'on', true)`;
      return write(tx);
    });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedDemoTournament(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('demo seed', () => {
    it('creates a running tournament with synthetic users and their predictions', async () => {
      const tournament = await prisma.tournament.findUniqueOrThrow({
        where: { slug: DEMO_SLUG },
      });
      expect(tournament.lifecycle).toBe('published');
      expect(await prisma.registration.count()).toBe(8);

      const users = await prisma.user.findMany({
        where: { email: { endsWith: '@demo.oracup.test' } },
      });
      expect(users).toHaveLength(13);
      for (const user of users) {
        expect(user.isSynthetic).toBe(true);
        expect(user.passwordHash).toBeNull();
      }

      // 8 teams: 4 first-round matches, 12 users predict each of them
      expect(await prisma.prediction.count()).toBe(48);
      expect(
        await prisma.prediction.count({
          where: { status: { not: 'pending' } },
        }),
      ).toBe(0);
      expect(await prisma.matchResult.count()).toBe(2);
    });

    it('does nothing the second time', async () => {
      const again = await seedDemoTournament(app);
      expect(again.created).toBe(false);
      expect(await prisma.tournament.count()).toBe(1);
      expect(await prisma.prediction.count()).toBe(48);
    });

    it('serves the demo tournament on the public API', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tournaments/${DEMO_SLUG}`)
        .expect(200);
      expect(res.body.status).toBe('running');
    });
  });

  describe('prediction', () => {
    it('allows one prediction per user and match', async () => {
      const { prediction, other } = await aPrediction();
      await expect(
        prisma.prediction.create({
          data: {
            userId: prediction.userId,
            matchId: prediction.matchId,
            pickedRegistrationId: other,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('lets the user change the pick, and keeps when it changed', async () => {
      const { prediction, other } = await aPrediction();
      const updated = await prisma.prediction.update({
        where: { id: prediction.id },
        data: { pickedRegistrationId: other, scoreSlot1: 2, scoreSlot2: 0 },
      });
      expect(updated.pickedRegistrationId).toBe(other);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        prediction.updatedAt.getTime(),
      );
      expect(updated.createdAt).toEqual(prediction.createdAt);
    });

    it('needs both sides of an exact score, never negative', async () => {
      const { prediction } = await aPrediction();
      await expect(
        prisma.prediction.update({
          where: { id: prediction.id },
          data: { scoreSlot1: 2, scoreSlot2: null },
        }),
      ).rejects.toThrow(/prediction_exact_score_complete/);
      await expect(
        prisma.prediction.update({
          where: { id: prediction.id },
          data: { scoreSlot1: -1, scoreSlot2: 2 },
        }),
      ).rejects.toThrow(/prediction_exact_score_positive/);
    });

    it('leaves the outcome to the recalculation', async () => {
      const { prediction } = await aPrediction();
      await expect(
        prisma.prediction.update({
          where: { id: prediction.id },
          data: { status: 'correct', points: 3, resolvedAt: new Date() },
        }),
      ).rejects.toThrow(/only the recalculation job can change it/);

      const resolved = await asRecompute((tx) =>
        tx.prediction.update({
          where: { id: prediction.id },
          data: { status: 'correct', points: 3, resolvedAt: new Date() },
        }),
      );
      expect(resolved).toMatchObject({ status: 'correct', points: 3 });
    });

    it('starts pending, and a resolved one has its date', async () => {
      const { prediction, other } = await aPrediction();
      const user = await prisma.user.create({
        data: { email: 'new@demo.oracup.test', displayName: 'Nouveau' },
      });
      await expect(
        prisma.prediction.create({
          data: {
            userId: user.id,
            matchId: prediction.matchId,
            pickedRegistrationId: other,
            status: 'wrong',
          },
        }),
      ).rejects.toThrow(/insert it pending/);
      await expect(
        asRecompute((tx) =>
          tx.prediction.update({
            where: { id: prediction.id },
            data: { status: 'correct', resolvedAt: null },
          }),
        ),
      ).rejects.toThrow(/prediction_resolved_consistent/);
    });
  });

  describe('scoring config', () => {
    it('has defaults, and refuses negative points', async () => {
      const tournament = await prisma.tournament.findUniqueOrThrow({
        where: { slug: DEMO_SLUG },
      });
      const config = await prisma.scoringConfig.create({
        data: { tournamentId: tournament.id },
      });
      expect(config).toMatchObject({
        pointsCorrectPick: 3,
        exactScoreBonus: 2,
        roundIncrement: 1,
      });
      await expect(
        prisma.scoringConfig.update({
          where: { tournamentId: tournament.id },
          data: { exactScoreBonus: -1 },
        }),
      ).rejects.toThrow(/scoring_config_points_positive/);
    });

    it('goes away with a deleted draft', async () => {
      const { cookie } = await signedInAs(app, 'admin');
      const draft = await request(app.getHttpServer())
        .post('/tournaments')
        .set('Cookie', cookie)
        .send({ name: 'Brouillon', game: 'Rocket League' })
        .expect(201);
      await prisma.scoringConfig.create({
        data: { tournamentId: draft.body.id, pointsCorrectPick: 5 },
      });
      await request(app.getHttpServer())
        .delete(`/tournaments/${draft.body.id}`)
        .set('Cookie', cookie)
        .expect(204);
      expect(
        await prisma.scoringConfig.count({
          where: { tournamentId: draft.body.id },
        }),
      ).toBe(0);
    });
  });

  describe('score audit log', () => {
    it('keeps every entry: no update, no delete', async () => {
      const { prediction } = await aPrediction();
      const tournament = await prisma.tournament.findUniqueOrThrow({
        where: { slug: DEMO_SLUG },
      });
      const entry = await prisma.scoreAuditLog.create({
        data: {
          tournamentId: tournament.id,
          matchId: prediction.matchId,
          actorUserId: tournament.ownerUserId,
          action: 'result_corrected',
          oldValue: { scores: [3, 1], winnerSlot: 1 },
          newValue: { scores: [1, 3], winnerSlot: 2 },
          reason: 'Scores inversés',
        },
      });
      expect(entry.newValue).toEqual({ scores: [1, 3], winnerSlot: 2 });

      await expect(
        prisma.scoreAuditLog.update({
          where: { id: entry.id },
          data: { reason: 'autre' },
        }),
      ).rejects.toThrow(/append-only history/);
      await expect(
        prisma.scoreAuditLog.delete({ where: { id: entry.id } }),
      ).rejects.toThrow(/append-only history/);
    });
  });
});
