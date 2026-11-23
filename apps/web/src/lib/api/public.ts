import { cacheLife, cacheTag } from "next/cache";
import { createApiClient } from "./create-client";
import { isApiError } from "./errors";
import type { Bracket, Tournament } from "./models";

// Public pages read the API as an anonymous visitor, from the server, and
// keep the answers in Next's cache. Saving a result expires the tags (see
// src/lib/api/refresh-public.ts); "minutes" is the fallback for changes
// made elsewhere.

export const TOURNAMENTS_TAG = "tournaments";
export const tournamentTag = (slug: string) => `tournament:${slug}`;

const publicApi = () =>
  createApiClient({ baseUrl: process.env.API_URL ?? "http://localhost:4000" });

// Null for a 404, so the page shows "not found" instead of an error
const unlessNotFound = (caught: unknown) => {
  if (isApiError(caught) && caught.status === 404) return null;
  throw caught;
};

// Running and finished tournaments: drafts stay hidden from visitors
export async function getPublicTournaments() {
  "use cache";
  cacheTag(TOURNAMENTS_TAG);
  cacheLife("minutes");
  return publicApi().get<Tournament[]>("/tournaments");
}

// A tournament and its bracket, by slug; null when there is no such public
// tournament. The bracket is null until it is generated.
export async function getPublicTournament(slug: string) {
  "use cache";
  cacheTag(tournamentTag(slug), TOURNAMENTS_TAG);
  cacheLife("minutes");
  const api = publicApi();
  const tournament = await api
    .get<Tournament>(`/tournaments/${encodeURIComponent(slug)}`)
    .catch(unlessNotFound);
  if (!tournament) return null;
  const bracket = await api
    .get<Bracket>(`/tournaments/${tournament.id}/bracket`)
    .catch(unlessNotFound);
  return { tournament, bracket };
}
