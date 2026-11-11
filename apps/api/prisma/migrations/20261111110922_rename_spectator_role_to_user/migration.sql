-- The "spectator" role is called "user" (ticket #9). Renaming the enum value
-- keeps every existing account on its role, where dropping and recreating
-- the enum would fail on rows that use it.
ALTER TYPE "user_role" RENAME VALUE 'spectator' TO 'user';

ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'user';
