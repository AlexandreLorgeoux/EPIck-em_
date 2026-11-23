"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { TOURNAMENTS_TAG, tournamentTag } from "@/lib/api/public";
import { ACCESS_COOKIE, readAccessToken } from "@/lib/auth/session-token";

/**
 * Expires the cached public pages of a tournament, so the next visitor
 * sees a result as soon as it is saved. Called by the admin screens after
 * a change; anyone can reach a server action, so it checks the caller is
 * an admin, and it only ever drops a cache entry.
 */
export async function refreshPublicTournament(slug: string) {
  const user = await readAccessToken(
    (await cookies()).get(ACCESS_COOKIE)?.value,
  );
  if (user?.role !== "admin") return;
  if (typeof slug !== "string" || !slug || slug.length > 200) return;
  updateTag(tournamentTag(slug));
  updateTag(TOURNAMENTS_TAG);
}
