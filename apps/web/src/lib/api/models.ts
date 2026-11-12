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
