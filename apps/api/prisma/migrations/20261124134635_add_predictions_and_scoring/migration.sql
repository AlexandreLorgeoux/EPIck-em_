-- CreateEnum
CREATE TYPE "prediction_status" AS ENUM ('pending', 'correct', 'wrong', 'cancelled');

-- CreateEnum
CREATE TYPE "score_audit_action" AS ENUM ('result_recorded', 'result_corrected', 'scoring_changed');

-- CreateTable
CREATE TABLE "scoring_config" (
    "tournament_id" UUID NOT NULL,
    "points_correct_pick" INTEGER NOT NULL DEFAULT 3,
    "exact_score_bonus" INTEGER NOT NULL DEFAULT 2,
    "round_increment" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,

    CONSTRAINT "scoring_config_pkey" PRIMARY KEY ("tournament_id")
);

-- CreateTable
CREATE TABLE "prediction" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "picked_registration_id" UUID NOT NULL,
    "score_slot_1" INTEGER,
    "score_slot_2" INTEGER,
    "status" "prediction_status" NOT NULL DEFAULT 'pending',
    "points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_audit_log" (
    "id" BIGSERIAL NOT NULL,
    "tournament_id" UUID NOT NULL,
    "match_id" UUID,
    "actor_user_id" UUID,
    "action" "score_audit_action" NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prediction_match_id_idx" ON "prediction"("match_id");

-- CreateIndex
CREATE INDEX "prediction_picked_registration_id_idx" ON "prediction"("picked_registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "prediction_user_id_match_id_key" ON "prediction"("user_id", "match_id");

-- CreateIndex
CREATE INDEX "score_audit_log_tournament_id_created_at_idx" ON "score_audit_log"("tournament_id", "created_at");

-- CreateIndex
CREATE INDEX "score_audit_log_match_id_idx" ON "score_audit_log"("match_id");

-- AddForeignKey
ALTER TABLE "scoring_config" ADD CONSTRAINT "scoring_config_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_config" ADD CONSTRAINT "scoring_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction" ADD CONSTRAINT "prediction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction" ADD CONSTRAINT "prediction_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction" ADD CONSTRAINT "prediction_picked_registration_id_fkey" FOREIGN KEY ("picked_registration_id") REFERENCES "registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_audit_log" ADD CONSTRAINT "score_audit_log_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_audit_log" ADD CONSTRAINT "score_audit_log_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_audit_log" ADD CONSTRAINT "score_audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Written by hand: checks and triggers Prisma cannot express

-- Scores and points are never negative; an exact score has both sides
ALTER TABLE "prediction"
  ADD CONSTRAINT "prediction_exact_score_complete"
    CHECK (("score_slot_1" IS NULL) = ("score_slot_2" IS NULL)),
  ADD CONSTRAINT "prediction_exact_score_positive"
    CHECK ("score_slot_1" >= 0 AND "score_slot_2" >= 0),
  ADD CONSTRAINT "prediction_points_positive" CHECK ("points" >= 0),
  -- Resolved exactly when it left pending
  ADD CONSTRAINT "prediction_resolved_consistent"
    CHECK (("status" = 'pending') = ("resolved_at" IS NULL));

ALTER TABLE "scoring_config"
  ADD CONSTRAINT "scoring_config_points_positive"
    CHECK ("points_correct_pick" >= 0 AND "exact_score_bonus" >= 0 AND "round_increment" >= 0);

-- A prediction is the user's input, but its outcome is derived: status,
-- points and resolved_at are written only by the recalculation, which runs
-- `SET LOCAL app.recompute = 'on'` (section 6.7 of the data model)
CREATE FUNCTION guard_prediction_outcome() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.recompute', true) IS NOT DISTINCT FROM 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND (NEW."status" <> 'pending' OR NEW."points" <> 0 OR NEW."resolved_at" IS NOT NULL) THEN
    RAISE EXCEPTION 'prediction outcome is derived: insert it pending, the recalculation resolves it';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW."status" IS DISTINCT FROM OLD."status"
      OR NEW."points" IS DISTINCT FROM OLD."points"
      OR NEW."resolved_at" IS DISTINCT FROM OLD."resolved_at") THEN
    RAISE EXCEPTION 'prediction outcome is derived: only the recalculation job can change it';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "prediction_outcome_derived" BEFORE INSERT OR UPDATE ON "prediction"
  FOR EACH ROW EXECUTE FUNCTION guard_prediction_outcome();

-- History is append-only: an entry is never edited or removed
CREATE FUNCTION reject_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only history: entries are never changed or deleted', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER "score_audit_log_append_only" BEFORE UPDATE OR DELETE ON "score_audit_log"
  FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
