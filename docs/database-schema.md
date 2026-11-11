# Database schema

What is actually implemented in PostgreSQL today. The full target design, with every table and the reasons behind it, is in [data-model.md](./data-model.md). This page covers the sprint 2 slice: tournaments, teams, players, registrations, matches and results, with the derived bracket state (ticket #19), plus sign-in sessions (ticket #9).

- Source of truth: `apps/api/prisma/schema.prisma`
- Migrations: `apps/api/prisma/migrations/`

## Diagram

```mermaid
erDiagram
  game ||--o{ tournament : "is played in"
  user ||--o{ tournament : owns
  user ||--o{ session : "signs in with"
  tournament |o--o{ tournament : "duplicated from"
  tournament ||--o{ stage : has
  tournament ||--o{ registration : has
  stage ||--o{ match : contains
  match ||--o{ match_slot : has
  match |o--o{ match_slot : "feeds (winner or loser)"
  stage |o--o{ match_slot : "feeds (rank)"

  user |o--o{ player : "is linked to"
  player |o--o{ team : captains
  team ||--o{ team_member : has
  player ||--o{ team_member : "plays in"
  team |o--o{ registration : enters
  player |o--o{ registration : enters

  match ||--o{ match_result : "has versions"
  match_result |o--o| match_result : supersedes
  user |o--o{ match_result : reports
  match_result ||--o{ match_result_entrant : lists
  registration ||--o{ match_result_entrant : "reported in"
  match_result ||--o{ round : has
  round ||--o{ round_score : has

  match_slot ||--o| slot_assignment : "filled by"
  registration |o--o{ slot_assignment : "sits in"
  match ||--o| match_outcome : "decided by"
  match_result |o--o{ match_outcome : "used by"
  registration |o--o{ match_outcome : "winner or loser"

  source |o--o{ tournament : imports
  source |o--o{ team : imports
  source |o--o{ player : imports
  source |o--o{ registration : imports
  source |o--o{ match_result : imports

  game {
    uuid id PK
    text slug UK
    text name
    enum participant_kind
    int max_team_size
    bool draw_allowed
  }
  source {
    uuid id PK
    enum kind "startgg, manual, csv, json"
    text name
    jsonb config "never secrets"
  }
  session {
    uuid id PK
    uuid user_id FK
    text token_hash UK "SHA-256 of the refresh token"
    timestamptz expires_at
    timestamptz revoked_at
  }
  user {
    uuid id PK
    text email UK
    text display_name
    enum role "admin, player, spectator"
    bool is_synthetic
    text password_hash "argon2id, null if no sign-in"
  }
  tournament {
    uuid id PK
    uuid game_id FK
    uuid owner_user_id FK
    text slug UK
    enum lifecycle "draft, published, archived"
    enum visibility
    enum registration_mode
    enum origin "internal, imported"
    bool read_only
  }
  stage {
    uuid id PK
    uuid tournament_id FK
    int position "unique per tournament"
    enum format "single_elim, swiss, ..."
    enum prediction_mode
    jsonb params "best-of, tie-breaks"
  }
  team {
    uuid id PK
    text name
    uuid captain_player_id FK
  }
  player {
    uuid id PK
    uuid user_id FK "null if never signed up"
    text handle
  }
  team_member {
    uuid team_id PK
    uuid player_id PK
    date joined_on PK
    date left_on
    bool is_substitute
  }
  registration {
    uuid id PK
    uuid tournament_id FK
    uuid team_id FK "team or player, never both"
    uuid player_id FK
    int seed
    enum status
  }
  match {
    uuid id PK
    uuid stage_id FK
    int bracket_round
    int position
    int best_of
  }
  match_slot {
    uuid id PK
    uuid match_id FK
    int position
    enum feeder_kind "seed, match_winner, match_loser, stage_rank, bye"
    int seed_number
    uuid feeder_match_id FK
    uuid feeder_stage_id FK
  }
  match_result {
    bigint id PK
    uuid match_id FK
    int version "unique per match"
    enum outcome_kind "played, forfeit, disqualification, void"
    int declared_winner_slot
    text reason "required from version 2"
    bigint supersedes_id FK
    timestamptz recorded_at
  }
  match_result_entrant {
    bigint match_result_id PK
    int slot_position PK
    uuid registration_id FK
  }
  round {
    uuid id PK
    bigint match_result_id FK
    int number
  }
  round_score {
    uuid round_id PK
    int slot_position PK
    int score
    int placement
  }
  slot_assignment {
    uuid match_slot_id PK
    uuid registration_id FK
    enum state "open, assigned, bye"
    enum resolved_from
  }
  match_outcome {
    uuid match_id PK
    enum state "pending, decided, void, stale, conflict"
    bigint result_id FK
    uuid winner_registration_id FK
    uuid loser_registration_id FK
  }
```

## Kinds of tables

Every table is one of the kinds defined in [data-model.md, section 3](./data-model.md#3-raw-setup-derived-history).

| Kind | Tables | Who writes |
| --- | --- | --- |
| Setup | `game`, `source`, `user`, `tournament`, `stage`, `team`, `player`, `team_member`, `match`, `match_slot` | The API, on organizer actions |
| Raw | `registration`, `match_result`, `match_result_entrant`, `round`, `round_score` | The API, on result entry or import |
| Derived | `slot_assignment`, `match_outcome` | The recalculation job only |
| Sessions | `session` | The API, on sign-in, refresh and sign-out (outside the data model kinds) |

A match slot says **where** its participant comes from (seed 3, winner of match 5). Who actually sits there is derived (`slot_assignment`), so correcting a result moves the bracket without touching the setup.

## Rules enforced by the database

These rules live in the migration, not only in the API code:

| Rule | How |
| --- | --- |
| A registration enters a team or a player, never both or neither | `CHECK` constraint `registration_one_participant` |
| Results are never edited: a correction is a new version | Triggers reject `UPDATE` and `DELETE` on `match_result`, `match_result_entrant`, `round`, `round_score` |
| Version 2 and later give a reason and point to the version they replace | `CHECK` constraints on `match_result` |
| Derived tables are only written by the recalculation job | Triggers reject any write unless the transaction ran `SET LOCAL app.recompute = 'on'` |

Writing derived rows from the job, with Prisma:

```ts
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT set_config('app.recompute', 'on', true)`;
  // write slot_assignment and match_outcome here
});
```

## Sign-in sessions

Signing in sets two httpOnly cookies. The **access token** is a signed JWT valid 15 minutes, checked without a database read. The **refresh token** is random, valid 7 days, and only its SHA-256 hash is stored in `session`, so a database leak does not expose usable tokens.

- `POST /auth/refresh` replaces the refresh token: the old one stops working at once.
- `POST /auth/logout` and a role change set `revoked_at`, so the session cannot be refreshed any more.
- Passwords are stored as argon2id hashes in `user.password_hash`, never in clear.

## Not implemented yet

Left out of the sprint 2 slice, to be added with the tickets that need them:

- Tables: `season`, `pool`, `station`, `source_import`, `source_record`, `dispute`, and everything about predictions, leaderboards and recalculation history (`outbox_event`, `recompute_run`).
- Columns pointing to those tables: `tournament.season_id`, `match.station_id`, `match.pool_id`, `match_slot.feeder_pool_id`, `registration.source_record_id`, `match_result.source_record_id`, `match_result.dispute_id`.
- A separate database role for the API (section 6.7 of the data model). The triggers already block writes to derived tables.

## Changing the schema

1. Edit `apps/api/prisma/schema.prisma`.
2. With the database running (`docker compose up -d db`):
   ```bash
   npm run db:migrate -w apps/api -- --name <what_changed>
   ```
   This writes a new folder in `prisma/migrations/`, applies it locally and regenerates the client.
3. For a rule Prisma cannot express (trigger, `CHECK`), use `-- --create-only`, edit the generated SQL, then run `npm run db:migrate -w apps/api`.
4. Commit the schema and the migration folder together, and update this page.

`docker compose up` applies pending migrations automatically through the `migrate` service, before the API starts.
