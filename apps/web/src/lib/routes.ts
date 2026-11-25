import type { Role } from "@/lib/api/models";

// Every page of the web app. Link with these instead of writing paths by
// hand, so a renamed page is renamed everywhere.
export const routes = {
  // Public: anyone, signed in or not
  home: "/",
  login: "/login",
  tournaments: "/tournaments",
  tournament: (slug: string) => `/tournaments/${encodeURIComponent(slug)}`,
  leaderboard: (slug: string) =>
    `/tournaments/${encodeURIComponent(slug)}/leaderboard`,
  // Shown, at the same URL, in place of a page the user's role cannot open
  forbidden: "/forbidden",

  // Admin area (tickets #25 to #27)
  admin: {
    home: "/admin",
    teams: "/admin/teams",
    newTeam: "/admin/teams/new",
    team: (id: string) => `/admin/teams/${id}`,
    players: "/admin/players",
    newPlayer: "/admin/players/new",
    player: (id: string) => `/admin/players/${id}`,
    tournaments: "/admin/tournaments",
    newTournament: "/admin/tournaments/new",
    tournament: (id: string) => `/admin/tournaments/${id}`,
    results: (id: string) => `/admin/tournaments/${id}/results`,
    users: "/admin/users",
  },
} as const;

// Who may open which part of the site, checked by src/proxy.ts before the
// page renders. A path matches a rule when it is the prefix itself or below
// it ("/admin" and "/admin/teams", not "/administration"). Pages under no
// rule are public. The API checks permissions again on every request: these
// rules only spare users a page they cannot use.
export interface AccessRule {
  prefix: string;
  // Roles allowed in; "signed-in" lets any signed-in user through
  allow: readonly Role[] | "signed-in";
}

export const accessRules: readonly AccessRule[] = [
  { prefix: routes.admin.home, allow: ["admin"] },
];
