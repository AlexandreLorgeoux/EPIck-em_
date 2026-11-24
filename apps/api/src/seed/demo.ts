import type { INestApplicationContext } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BracketService } from '../tournaments/bracket.service.js';
import { MatchResultsService } from '../tournaments/match-results.service.js';
import { TournamentTeamsService } from '../tournaments/tournament-teams.service.js';
import { TournamentsService } from '../tournaments/tournaments.service.js';

// Demo data for the defence and for trying the predictions: one running
// tournament, synthetic users and their predictions. Everything is
// fictitious (CHARTE.md): animal team names, pseudonyms and .test
// addresses, never a real player or tournament.

export const DEMO_SLUG = 'coupe-de-demonstration';

const TEAMS = [
  'Marmottes',
  'Quokkas',
  'Faucons',
  'Lynx',
  'Castors',
  'Hérissons',
  'Loutres',
  'Blaireaux',
];

const PSEUDOS = [
  'Pronostiqueur Alpaga',
  'Loutre Lucide',
  'Hibou Hardi',
  'Renard Rusé',
  'Panda Patient',
  'Gecko Malin',
  'Bison Calme',
  'Koala Vif',
  'Moineau Têtu',
  'Phoque Joyeux',
  'Tapir Sage',
  'Zèbre Zen',
];

// Same draw on every run (mulberry32), so the demo is reproducible
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoSummary {
  created: boolean;
  slug: string;
  users: number;
  predictions: number;
  results: number;
}

/**
 * Creates the demo tournament through the same services as the admin
 * screens, so it follows every rule of the API. Does nothing when it
 * already exists. Entering the results resolves the predictions on those
 * matches, like for any result.
 */
export async function seedDemoTournament(
  app: INestApplicationContext,
  { results = 2 }: { results?: number } = {},
): Promise<DemoSummary> {
  const prisma = app.get(PrismaService);
  const tournaments = app.get(TournamentsService, { strict: false });
  const teams = app.get(TournamentTeamsService, { strict: false });
  const bracket = app.get(BracketService, { strict: false });
  const matchResults = app.get(MatchResultsService, { strict: false });

  const existing = await prisma.tournament.findUnique({
    where: { slug: DEMO_SLUG },
  });
  if (existing) {
    return {
      created: false,
      slug: DEMO_SLUG,
      users: 0,
      predictions: 0,
      results: 0,
    };
  }

  const draw = random(47);
  const synthetic = (email: string, displayName: string) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      // No password: synthetic accounts cannot sign in
      create: { email, displayName, isSynthetic: true },
    });

  const organizer = await synthetic(
    'organisateur@demo.oracup.test',
    'Organisatrice démo',
  );
  await prisma.user.update({
    where: { id: organizer.id },
    data: { role: 'admin' },
  });
  const admin: AuthUser = { id: organizer.id, role: 'admin' };

  const tournament = await tournaments.create(
    {
      name: 'Coupe de démonstration',
      game: 'Rocket League',
      description: 'Tournoi fictif pour essayer les pronostics.',
    },
    admin,
  );
  for (const name of TEAMS) {
    const team =
      (await prisma.team.findFirst({ where: { name } })) ??
      (await prisma.team.create({ data: { name } }));
    await teams.add(tournament.id, { teamId: team.id });
  }
  await bracket.generate(tournament.id, { seeding: 'auto' });

  const users = [];
  for (const [i, pseudo] of PSEUDOS.entries()) {
    users.push(
      await synthetic(`pronostiqueur-${i + 1}@demo.oracup.test`, pseudo),
    );
  }

  // First round: both teams are known, so every user can predict
  const matches = await prisma.match.findMany({
    where: { stage: { tournamentId: tournament.id }, bracketRound: 1 },
    orderBy: { position: 'asc' },
    include: {
      slots: { orderBy: { position: 'asc' }, include: { assignment: true } },
    },
  });
  const playable = matches.filter((m) =>
    m.slots.every((s) => s.assignment?.state === 'assigned'),
  );

  let predictions = 0;
  for (const match of playable) {
    // Each match has its favourite, picked by about two users in three
    const favourite = draw() < 0.5 ? 0 : 1;
    for (const user of users) {
      const slot = draw() < 0.67 ? favourite : 1 - favourite;
      const exact = draw() < 0.5;
      const winner = 2 + Math.floor(draw() * 2);
      const loser = Math.floor(draw() * winner);
      await prisma.prediction.create({
        data: {
          userId: user.id,
          matchId: match.id,
          pickedRegistrationId: match.slots[slot].assignment!.registrationId!,
          scoreSlot1: exact ? (slot === 0 ? winner : loser) : null,
          scoreSlot2: exact ? (slot === 0 ? loser : winner) : null,
        },
      });
      predictions++;
    }
  }

  // A few results, so the demo has resolved predictions and points
  for (const match of playable.slice(0, results)) {
    const winnerSlot = draw() < 0.5 ? 1 : 2;
    await matchResults.record(
      match.id,
      { scores: winnerSlot === 1 ? [3, 1] : [1, 3], winnerSlot },
      admin,
    );
  }

  return {
    created: true,
    slug: DEMO_SLUG,
    users: users.length,
    predictions,
    results: Math.min(results, playable.length),
  };
}
