// Shapes of the objects the API returns, for typing calls:
// api.get<Team>(`/teams/${id}`). Keep them in line with apps/api.

export type Role = "admin" | "player" | "user";

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: string;
}

export interface PlayerTeam {
  id: string;
  name: string;
  tag: string | null;
  isSubstitute: boolean;
  role: string | null;
}

export interface Player {
  id: string;
  handle: string;
  userId: string | null;
  team: PlayerTeam | null;
}

export interface TeamMember {
  id: string;
  handle: string;
  isSubstitute: boolean;
  role: string | null;
  joinedOn: string;
}

export interface Team {
  id: string;
  name: string;
  tag: string | null;
  captainPlayerId: string | null;
  members: TeamMember[];
}

export type TournamentStatus = "draft" | "running" | "finished";

export interface Tournament {
  id: string;
  slug: string;
  name: string;
  game: { id: string; name: string };
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
  status: TournamentStatus;
  owner: { id: string; displayName: string };
}

// A team taking part in a tournament, with its seed once set
export interface TournamentTeam {
  id: string;
  name: string;
  tag: string | null;
  seed: number | null;
}

export type SeedingMode = "manual" | "auto";

// GET /tournaments/:id/bracket
export type MatchState = "pending" | "decided" | "void" | "stale" | "conflict";

export interface BracketSlot {
  position: number;
  // open: team not known yet; bye: no opponent
  state: "open" | "assigned" | "bye";
  seed: number | null;
  team: { id: string; name: string; tag: string | null } | null;
  score: number | null;
  winner: boolean;
}

export interface BracketMatch {
  id: string;
  label: string;
  position: number;
  state: MatchState;
  // False for a bye: decided without being played
  hasResult: boolean;
  slots: BracketSlot[];
}

export interface Bracket {
  stage: { id: string; name: string; format: string; seeding: SeedingMode };
  rounds: { round: number; matches: BracketMatch[] }[];
}
