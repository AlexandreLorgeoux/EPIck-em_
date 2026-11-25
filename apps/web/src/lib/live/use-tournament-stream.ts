"use client";

import { useEffect, useRef, useState } from "react";
import { apiBaseUrl } from "@/lib/api/client";

// connecting: not open yet; lost: dropped for a while, trying again
export type StreamStatus = "connecting" | "live" | "lost";

// A short drop is not worth a message
export const LOST_AFTER_MS = 5000;
// A result sends three events: wait for them all, then read once
export const SETTLE_MS = 300;
const RETRY_CHANGE_MS = 5000;
const MAX_REOPEN_MS = 30_000;

const CHANGES = ["match-result", "bracket", "leaderboard"] as const;

/**
 * Follows a tournament (GET /tournaments/:id/events) and calls `onChange`
 * once per new version, so the page reads again what it shows. It is also
 * called on the first connection, as what is on screen may be older, and
 * called again later when it rejects.
 *
 * The browser reconnects by itself after a network error, but gives up on
 * an HTTP error (the server restarting behind the proxy): it is reopened
 * here. Either way the first event gives the version, which tells whether
 * anything was missed. Nothing is open while the tab is hidden.
 */
export function useTournamentStream(
  tournamentId: string,
  onChange: () => Promise<void>,
): StreamStatus {
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    let source: EventSource | null = null;
    let lastVersion: string | null = null;
    let attempts = 0;
    let stopped = false;
    let changeTimer: ReturnType<typeof setTimeout> | undefined;
    let reopenTimer: ReturnType<typeof setTimeout> | undefined;
    let lostTimer: ReturnType<typeof setTimeout> | undefined;

    const readAgain = (delay: number) => {
      clearTimeout(changeTimer);
      changeTimer = setTimeout(() => {
        callback.current().catch(() => {
          if (!stopped) readAgain(RETRY_CHANGE_MS);
        });
      }, delay);
    };

    const received = (event: MessageEvent<string>) => {
      const { version } = JSON.parse(event.data) as { version: string };
      if (version === lastVersion) return;
      lastVersion = version;
      // Not all viewers at the same instant
      readAgain(SETTLE_MS + Math.random() * SETTLE_MS);
    };

    const close = () => {
      clearTimeout(reopenTimer);
      source?.close();
      source = null;
    };

    const open = () => {
      close();
      const current = new EventSource(
        `${apiBaseUrl}/tournaments/${tournamentId}/events`,
      );
      source = current;
      current.addEventListener("sync", (event) => {
        attempts = 0;
        clearTimeout(lostTimer);
        lostTimer = undefined;
        setStatus("live");
        received(event);
      });
      for (const type of CHANGES) current.addEventListener(type, received);
      current.onerror = () => {
        lostTimer ??= setTimeout(() => setStatus("lost"), LOST_AFTER_MS);
        if (current.readyState !== EventSource.CLOSED) return;
        const delay = Math.min(MAX_REOPEN_MS, 1000 * 2 ** attempts++);
        clearTimeout(reopenTimer);
        reopenTimer = setTimeout(open, delay + Math.random() * 1000);
      };
    };

    const onVisibility = () => {
      if (document.hidden) {
        // Closed on purpose: not a lost connection
        clearTimeout(lostTimer);
        lostTimer = undefined;
        close();
      } else if (!source) open();
    };
    const onOnline = () => {
      attempts = 0;
      if (!document.hidden) open();
    };

    if (!document.hidden) open();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      stopped = true;
      close();
      clearTimeout(changeTimer);
      clearTimeout(lostTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [tournamentId]);

  return status;
}
