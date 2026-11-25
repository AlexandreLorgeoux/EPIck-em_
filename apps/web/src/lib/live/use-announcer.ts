"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// At most one live announcement in this time: several results in a row
// are said in one sentence
export const ANNOUNCE_EVERY_MS = 10_000;

/**
 * Text for a polite live region that never floods its listener. `announce`
 * takes a function, called when the text is due: a later call replaces one
 * that is waiting, so it must describe everything since the last one said.
 */
export function useAnnouncer() {
  const [message, setMessage] = useState("");
  const waiting = useRef<(() => string) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSaid = useRef(-ANNOUNCE_EVERY_MS);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      timer.current = undefined;
    },
    [],
  );

  const announce = useCallback((text: () => string) => {
    waiting.current = text;
    if (timer.current !== undefined) return;
    const wait = lastSaid.current + ANNOUNCE_EVERY_MS - Date.now();
    timer.current = setTimeout(
      () => {
        timer.current = undefined;
        const said = waiting.current?.() ?? "";
        waiting.current = null;
        if (!said) return;
        lastSaid.current = Date.now();
        setMessage(said);
      },
      Math.max(0, wait),
    );
  }, []);

  return { message, announce };
}
