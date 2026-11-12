// Bridge between the API client and the AuthProvider (ticket #31). The
// provider registers how to renew the session and what to do when it is
// over; until then the client renews it by calling /auth/refresh itself.

export interface SessionHandlers {
  // Resolves true when the session was renewed
  refresh: () => Promise<boolean>;
  // The session cannot be renewed: sign the user out
  onExpired: () => void;
}

let handlers: SessionHandlers | null = null;

export function setSessionHandlers(next: SessionHandlers | null) {
  handlers = next;
}

export const sessionHandlers = () => handlers;

// Shares one call between everyone who asks while it runs: when several
// requests fail with 401 together, the session is refreshed once
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= fn().finally(() => {
      pending = null;
    });
    return pending;
  };
}
