import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { fieldException } from '../common/validation-errors.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePredictionDto } from './dto/create-prediction.dto.js';
import { ListPredictionsQuery } from './dto/list-predictions.query.js';
import { UpdatePredictionDto } from './dto/update-prediction.dto.js';
import { predictionLock, type LockReason } from './prediction-lock.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// What a prediction needs to know about its match: its teams, whether it
// is played, and its tournament
const matchSelect = {
  id: true,
  label: true,
  bracketRound: true,
  position: true,
  scheduledAt: true,
  _count: { select: { results: true } },
  stage: {
    select: {
      tournament: {
        select: { id: true, slug: true, name: true, lifecycle: true },
      },
    },
  },
  slots: {
    orderBy: { position: 'asc' },
    select: {
      position: true,
      assignment: {
        select: {
          state: true,
          registrationId: true,
          registration: {
            select: { team: { select: { id: true, name: true, tag: true } } },
          },
        },
      },
    },
  },
} satisfies Prisma.MatchSelect;

type MatchRow = Prisma.MatchGetPayload<{ select: typeof matchSelect }>;

const predictionInclude = {
  match: { select: matchSelect },
} satisfies Prisma.PredictionInclude;

type PredictionRow = Prisma.PredictionGetPayload<{
  include: typeof predictionInclude;
}>;

const lockMessages: Record<LockReason, (label: string) => string> = {
  bye: (label) => `${label} has a bye: there is nothing to predict`,
  'teams-unknown': (label) =>
    `${label} cannot be predicted yet: both teams are not known`,
  started: (label) => `${label} has started: predictions are locked`,
  played: (label) => `${label} is played: predictions are locked`,
};

// The lock, by the server clock: never trust a time sent by the client
const lockOf = (match: MatchRow, now = new Date()) =>
  predictionLock(
    {
      scheduledAt: match.scheduledAt,
      played: match._count.results > 0,
      slots: match.slots.map((s) => s.assignment?.state ?? 'open'),
    },
    now,
  );

const toResponse = (row: PredictionRow) => {
  const slots = row.match.slots;
  const picked = slots.find(
    (s) => s.assignment?.registrationId === row.pickedRegistrationId,
  );
  const { tournament } = row.match.stage;
  return {
    id: row.id,
    tournament: {
      id: tournament.id,
      slug: tournament.slug,
      name: tournament.name,
    },
    match: {
      id: row.match.id,
      label: row.match.label,
      round: row.match.bracketRound,
      scheduledAt: row.match.scheduledAt,
      teams: slots.map((s) => s.assignment?.registration?.team ?? null),
    },
    // Null when the picked team no longer plays this match (a correction
    // changed its teams): the recalculation cancels the prediction
    team: picked?.assignment?.registration?.team ?? null,
    score:
      row.scoreSlot1 === null || row.scoreSlot2 === null
        ? null
        : [row.scoreSlot1, row.scoreSlot2],
    status: row.status,
    points: row.points,
    locked: lockOf(row.match) !== null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

@Injectable()
export class PredictionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePredictionDto, user: AuthUser) {
    const match = await this.openMatch(dto.matchId, 'matchId');
    const registrationId = this.registrationOf(match, dto.teamId);
    const score = this.checkScore(match, registrationId, dto.score ?? null);
    try {
      const row = await this.prisma.prediction.create({
        data: {
          userId: user.id,
          matchId: match.id,
          pickedRegistrationId: registrationId,
          scoreSlot1: score?.[0] ?? null,
          scoreSlot2: score?.[1] ?? null,
        },
        include: predictionInclude,
      });
      return toResponse(row);
    } catch (caught) {
      // Two requests at once: the unique index keeps one prediction
      if (
        caught instanceof Prisma.PrismaClientKnownRequestError &&
        caught.code === 'P2002'
      ) {
        throw new ConflictException(
          `You already predicted ${match.label}: change that prediction instead`,
        );
      }
      throw caught;
    }
  }

  // Only the author can change a prediction; for anyone else it does not
  // exist, so its existence is not revealed
  async update(id: string, dto: UpdatePredictionDto, user: AuthUser) {
    const current = await this.prisma.prediction.findFirst({
      where: { id, userId: user.id },
    });
    if (!current) throw new NotFoundException(`No prediction ${id}`);
    const match = await this.openMatch(current.matchId);
    const registrationId = dto.teamId
      ? this.registrationOf(match, dto.teamId)
      : current.pickedRegistrationId;
    const previous =
      current.scoreSlot1 === null || current.scoreSlot2 === null
        ? null
        : [current.scoreSlot1, current.scoreSlot2];
    const score = this.checkScore(
      match,
      registrationId,
      dto.score === undefined ? previous : dto.score,
      // A score kept from before that no longer fits the new pick is
      // reported on teamId, the field that changed
      dto.score === undefined ? 'teamId' : 'score',
    );
    const row = await this.prisma.prediction.update({
      where: { id },
      data: {
        pickedRegistrationId: registrationId,
        scoreSlot1: score?.[0] ?? null,
        scoreSlot2: score?.[1] ?? null,
      },
      include: predictionInclude,
    });
    return toResponse(row);
  }

  // The signed-in user's predictions, in bracket order
  async listMine(user: AuthUser, query: ListPredictionsQuery) {
    const tournament = query.tournament
      ? UUID.test(query.tournament)
        ? { id: query.tournament }
        : { slug: query.tournament }
      : undefined;
    const rows = await this.prisma.prediction.findMany({
      where: {
        userId: user.id,
        match: tournament ? { stage: { tournament } } : undefined,
      },
      include: predictionInclude,
      orderBy: [
        { match: { stage: { tournamentId: 'asc' } } },
        { match: { bracketRound: 'asc' } },
        { match: { position: 'asc' } },
      ],
    });
    return rows.map(toResponse);
  }

  // The match, if it exists, is public and still takes predictions
  private async openMatch(id: string, field?: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      select: matchSelect,
    });
    // A draft tournament is not public: its matches are not found either
    if (!match || match.stage.tournament.lifecycle === 'draft') {
      const message = `No match with id ${id}`;
      if (field) throw fieldException(field, message);
      throw new NotFoundException(message);
    }
    const lock = lockOf(match);
    if (lock) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        // Lets a screen tell a lock from other conflicts (ticket #57)
        code: 'prediction_locked',
        reason: lock,
        message: lockMessages[lock](match.label),
      });
    }
    return match;
  }

  private registrationOf(match: MatchRow, teamId: string) {
    const slot = match.slots.find(
      (s) => s.assignment?.registration?.team?.id === teamId,
    );
    if (!slot) {
      const names = match.slots
        .map((s) => s.assignment?.registration?.team?.name)
        .join(' or ');
      throw fieldException(
        'teamId',
        `teamId must be one of the two teams of ${match.label}: ${names}`,
      );
    }
    return slot.assignment!.registrationId!;
  }

  // An exact score must name a winner, and that winner is the picked team
  private checkScore(
    match: MatchRow,
    registrationId: string,
    score: number[] | null,
    field = 'score',
  ) {
    if (!score) return null;
    const [first, second] = score;
    if (first === second) {
      throw fieldException(
        field,
        'score cannot be a tie: a match always has a winner',
      );
    }
    const winnerSlot = first > second ? 1 : 2;
    const pickedSlot = match.slots.find(
      (s) => s.assignment?.registrationId === registrationId,
    )?.position;
    if (pickedSlot !== winnerSlot) {
      throw fieldException(
        field,
        'score must give the picked team the higher score',
      );
    }
    return [first, second] as const;
  }
}
