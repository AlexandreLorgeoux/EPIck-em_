-- CreateEnum
CREATE TYPE "participant_kind" AS ENUM ('team', 'player');

-- CreateEnum
CREATE TYPE "source_kind" AS ENUM ('startgg', 'manual', 'csv', 'json');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'player', 'spectator');

-- CreateEnum
CREATE TYPE "tournament_lifecycle" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "tournament_visibility" AS ENUM ('public', 'invite_only');

-- CreateEnum
CREATE TYPE "venue_mode" AS ENUM ('online', 'onsite', 'mixed');

-- CreateEnum
CREATE TYPE "registration_mode" AS ENUM ('open', 'approval');

-- CreateEnum
CREATE TYPE "tournament_origin" AS ENUM ('internal', 'imported');

-- CreateEnum
CREATE TYPE "stage_format" AS ENUM ('single_elim', 'double_elim', 'round_robin', 'swiss', 'ffa');

-- CreateEnum
CREATE TYPE "seeding_mode" AS ENUM ('manual', 'auto');

-- CreateEnum
CREATE TYPE "prediction_mode" AS ENUM ('none', 'match_by_match', 'full_bracket', 'both');

-- CreateEnum
CREATE TYPE "registration_status" AS ENUM ('pending', 'registered', 'waitlisted', 'checked_in', 'withdrawn', 'disqualified');

-- CreateEnum
CREATE TYPE "feeder_kind" AS ENUM ('seed', 'match_winner', 'match_loser', 'stage_rank', 'bye');

-- CreateEnum
CREATE TYPE "outcome_kind" AS ENUM ('played', 'forfeit', 'disqualification', 'void');

-- CreateEnum
CREATE TYPE "slot_state" AS ENUM ('open', 'assigned', 'bye');

-- CreateEnum
CREATE TYPE "slot_resolved_from" AS ENUM ('seed', 'feeder', 'bye', 'none');

-- CreateEnum
CREATE TYPE "match_state" AS ENUM ('pending', 'decided', 'void', 'stale', 'conflict');

-- CreateTable
CREATE TABLE "game" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "participant_kind" "participant_kind" NOT NULL,
    "max_team_size" INTEGER NOT NULL,
    "draw_allowed" BOOLEAN NOT NULL DEFAULT false,
    "external_ref" TEXT,

    CONSTRAINT "game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source" (
    "id" UUID NOT NULL,
    "kind" "source_kind" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_synthetic" BOOLEAN NOT NULL DEFAULT false,
    "role" "user_role" NOT NULL DEFAULT 'spectator',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "lifecycle" "tournament_lifecycle" NOT NULL DEFAULT 'draft',
    "starts_at" TIMESTAMPTZ(6),
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "description" TEXT,
    "rules_text" TEXT,
    "visibility" "tournament_visibility" NOT NULL DEFAULT 'public',
    "venue_mode" "venue_mode" NOT NULL DEFAULT 'online',
    "venue" TEXT,
    "capacity" INTEGER,
    "registration_mode" "registration_mode" NOT NULL DEFAULT 'open',
    "checkin_opens_at" TIMESTAMPTZ(6),
    "checkin_closes_at" TIMESTAMPTZ(6),
    "team_min_starters" INTEGER NOT NULL DEFAULT 1,
    "team_max_starters" INTEGER NOT NULL DEFAULT 1,
    "team_max_substitutes" INTEGER NOT NULL DEFAULT 0,
    "origin" "tournament_origin" NOT NULL DEFAULT 'internal',
    "read_only" BOOLEAN NOT NULL DEFAULT false,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "duplicated_from_id" UUID,
    "source_id" UUID,
    "external_ref" TEXT,

    CONSTRAINT "tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage" (
    "id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "format" "stage_format" NOT NULL,
    "advance_count" INTEGER,
    "seeding_mode" "seeding_mode" NOT NULL DEFAULT 'manual',
    "prediction_mode" "prediction_mode" NOT NULL DEFAULT 'none',
    "prediction_locks_at" TIMESTAMPTZ(6),
    "params" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT,
    "captain_player_id" UUID,
    "source_id" UUID,
    "external_ref" TEXT,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "handle" TEXT NOT NULL,
    "source_id" UUID,
    "external_ref" TEXT,

    CONSTRAINT "player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "team_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "joined_on" DATE NOT NULL,
    "left_on" DATE,
    "is_substitute" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("team_id","player_id","joined_on")
);

-- CreateTable
CREATE TABLE "match" (
    "id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "bracket_round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "best_of" INTEGER NOT NULL DEFAULT 1,
    "scheduled_at" TIMESTAMPTZ(6),
    "estimated_minutes" INTEGER,

    CONSTRAINT "match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_slot" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "feeder_kind" "feeder_kind" NOT NULL,
    "seed_number" INTEGER,
    "feeder_match_id" UUID,
    "feeder_stage_id" UUID,
    "feeder_rank" INTEGER,

    CONSTRAINT "match_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration" (
    "id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "team_id" UUID,
    "player_id" UUID,
    "seed" INTEGER,
    "status" "registration_status" NOT NULL DEFAULT 'registered',
    "checked_in_at" TIMESTAMPTZ(6),
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "source_id" UUID,

    CONSTRAINT "registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_result" (
    "id" BIGSERIAL NOT NULL,
    "match_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "outcome_kind" "outcome_kind" NOT NULL,
    "declared_winner_slot" INTEGER,
    "reason" TEXT,
    "reported_by" UUID,
    "source_id" UUID,
    "supersedes_id" BIGINT,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_result_entrant" (
    "match_result_id" BIGINT NOT NULL,
    "slot_position" INTEGER NOT NULL,
    "registration_id" UUID NOT NULL,

    CONSTRAINT "match_result_entrant_pkey" PRIMARY KEY ("match_result_id","slot_position")
);

-- CreateTable
CREATE TABLE "round" (
    "id" UUID NOT NULL,
    "match_result_id" BIGINT NOT NULL,
    "number" INTEGER NOT NULL,
    "variant" TEXT,
    "duration_seconds" INTEGER,

    CONSTRAINT "round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "round_score" (
    "round_id" UUID NOT NULL,
    "slot_position" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "placement" INTEGER,

    CONSTRAINT "round_score_pkey" PRIMARY KEY ("round_id","slot_position")
);

-- CreateTable
CREATE TABLE "slot_assignment" (
    "match_slot_id" UUID NOT NULL,
    "registration_id" UUID,
    "state" "slot_state" NOT NULL,
    "resolved_from" "slot_resolved_from" NOT NULL,

    CONSTRAINT "slot_assignment_pkey" PRIMARY KEY ("match_slot_id")
);

-- CreateTable
CREATE TABLE "match_outcome" (
    "match_id" UUID NOT NULL,
    "state" "match_state" NOT NULL,
    "result_id" BIGINT,
    "winner_registration_id" UUID,
    "loser_registration_id" UUID,

    CONSTRAINT "match_outcome_pkey" PRIMARY KEY ("match_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_slug_key" ON "game"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_slug_key" ON "tournament"("slug");

-- CreateIndex
CREATE INDEX "tournament_game_id_idx" ON "tournament"("game_id");

-- CreateIndex
CREATE INDEX "tournament_owner_user_id_idx" ON "tournament"("owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "stage_tournament_id_position_key" ON "stage"("tournament_id", "position");

-- CreateIndex
CREATE INDEX "player_user_id_idx" ON "player"("user_id");

-- CreateIndex
CREATE INDEX "team_member_player_id_idx" ON "team_member"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_stage_id_bracket_round_position_key" ON "match"("stage_id", "bracket_round", "position");

-- CreateIndex
CREATE INDEX "match_slot_feeder_match_id_idx" ON "match_slot"("feeder_match_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_slot_match_id_position_key" ON "match_slot"("match_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "registration_tournament_id_team_id_key" ON "registration"("tournament_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "registration_tournament_id_player_id_key" ON "registration"("tournament_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_result_supersedes_id_key" ON "match_result"("supersedes_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_result_match_id_version_key" ON "match_result"("match_id", "version");

-- CreateIndex
CREATE INDEX "match_result_entrant_registration_id_idx" ON "match_result_entrant"("registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "round_match_result_id_number_key" ON "round"("match_result_id", "number");

-- CreateIndex
CREATE INDEX "slot_assignment_registration_id_idx" ON "slot_assignment"("registration_id");

-- AddForeignKey
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_duplicated_from_id_fkey" FOREIGN KEY ("duplicated_from_id") REFERENCES "tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage" ADD CONSTRAINT "stage_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_captain_player_id_fkey" FOREIGN KEY ("captain_player_id") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player" ADD CONSTRAINT "player_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player" ADD CONSTRAINT "player_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_slot" ADD CONSTRAINT "match_slot_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_slot" ADD CONSTRAINT "match_slot_feeder_match_id_fkey" FOREIGN KEY ("feeder_match_id") REFERENCES "match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_slot" ADD CONSTRAINT "match_slot_feeder_stage_id_fkey" FOREIGN KEY ("feeder_stage_id") REFERENCES "stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration" ADD CONSTRAINT "registration_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration" ADD CONSTRAINT "registration_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration" ADD CONSTRAINT "registration_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration" ADD CONSTRAINT "registration_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_result" ADD CONSTRAINT "match_result_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_result" ADD CONSTRAINT "match_result_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_result" ADD CONSTRAINT "match_result_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_result" ADD CONSTRAINT "match_result_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "match_result"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_result_entrant" ADD CONSTRAINT "match_result_entrant_match_result_id_fkey" FOREIGN KEY ("match_result_id") REFERENCES "match_result"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_result_entrant" ADD CONSTRAINT "match_result_entrant_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round" ADD CONSTRAINT "round_match_result_id_fkey" FOREIGN KEY ("match_result_id") REFERENCES "match_result"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_score" ADD CONSTRAINT "round_score_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_assignment" ADD CONSTRAINT "slot_assignment_match_slot_id_fkey" FOREIGN KEY ("match_slot_id") REFERENCES "match_slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_assignment" ADD CONSTRAINT "slot_assignment_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_outcome" ADD CONSTRAINT "match_outcome_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_outcome" ADD CONSTRAINT "match_outcome_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "match_result"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_outcome" ADD CONSTRAINT "match_outcome_winner_registration_id_fkey" FOREIGN KEY ("winner_registration_id") REFERENCES "registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_outcome" ADD CONSTRAINT "match_outcome_loser_registration_id_fkey" FOREIGN KEY ("loser_registration_id") REFERENCES "registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Rules from docs/data-model.md that Prisma cannot express
-- ---------------------------------------------------------------------------

-- A registration enters exactly one participant: a team or a player
ALTER TABLE "registration"
  ADD CONSTRAINT "registration_one_participant"
  CHECK (("team_id" IS NULL) <> ("player_id" IS NULL));

-- Version 1 is the first result; every later version explains itself and
-- points to the version it replaces
ALTER TABLE "match_result"
  ADD CONSTRAINT "match_result_version_positive" CHECK ("version" >= 1),
  ADD CONSTRAINT "match_result_reason_required" CHECK ("version" = 1 OR "reason" IS NOT NULL),
  ADD CONSTRAINT "match_result_supersedes_consistent" CHECK (("version" = 1) = ("supersedes_id" IS NULL));

-- Raw results are append-only (section 3.1): a correction is a new version
CREATE FUNCTION reject_raw_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: insert a new match_result version instead', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER "match_result_append_only" BEFORE UPDATE OR DELETE ON "match_result"
  FOR EACH ROW EXECUTE FUNCTION reject_raw_mutation();
CREATE TRIGGER "match_result_entrant_append_only" BEFORE UPDATE OR DELETE ON "match_result_entrant"
  FOR EACH ROW EXECUTE FUNCTION reject_raw_mutation();
CREATE TRIGGER "round_append_only" BEFORE UPDATE OR DELETE ON "round"
  FOR EACH ROW EXECUTE FUNCTION reject_raw_mutation();
CREATE TRIGGER "round_score_append_only" BEFORE UPDATE OR DELETE ON "round_score"
  FOR EACH ROW EXECUTE FUNCTION reject_raw_mutation();

-- Derived tables are written only by the recalculation job (section 6.7),
-- which runs `SET LOCAL app.recompute = 'on'` inside its transaction
CREATE FUNCTION guard_derived_write() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.recompute', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION '% is derived: only the recalculation job can write it', TG_TABLE_NAME;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "slot_assignment_derived_only" BEFORE INSERT OR UPDATE OR DELETE ON "slot_assignment"
  FOR EACH ROW EXECUTE FUNCTION guard_derived_write();
CREATE TRIGGER "match_outcome_derived_only" BEFORE INSERT OR UPDATE OR DELETE ON "match_outcome"
  FOR EACH ROW EXECUTE FUNCTION guard_derived_write();
