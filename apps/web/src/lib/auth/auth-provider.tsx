"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api/client";
import type { Role, User } from "@/lib/api/models";
import { setSessionHandlers, singleFlight } from "@/lib/api/session";
import { loginPath, safeReturnPath } from "./return-path";

export const SESSION_EXPIRED_MESSAGE =
  "Ta session a expiré. Reconnecte-toi pour continuer.";

export interface AuthContextValue {
  user: User | null;
  role: Role | null;
  // True until we know whether someone is signed in
  loading: boolean;
  // Set when an expired session sent the user to the login page
  sessionExpired: boolean;
  // Rejects with an ApiError (wrong credentials, invalid fields) for the form
  login: (
    email: string,
    password: string,
    returnTo?: string | null,
  ) => Promise<void>;
  logout: () => Promise<void>;
  // Resolves true when the session was renewed
  refresh: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  // Read by the API client callbacks, which outlive a single render
  const userRef = useRef<User | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Several requests can fail together: they share one refresh request
  const refresh = useMemo(
    () =>
      singleFlight(async () => {
        try {
          setUser(await api.post<User>("/auth/refresh"));
          return true;
        } catch {
          return false;
        }
      }),
    [],
  );

  const expire = useCallback(() => {
    // A visitor who was never signed in has no session to lose
    if (!userRef.current) return;
    setUser(null);
    setSessionExpired(true);
    setAnnouncement(SESSION_EXPIRED_MESSAGE);
    const { pathname, search } = window.location;
    router.replace(loginPath(pathname + search));
  }, [router]);

  // The API client calls these on a 401 (see lib/api/session.ts)
  useEffect(() => {
    setSessionHandlers({ refresh, onExpired: expire });
    return () => setSessionHandlers(null);
  }, [refresh, expire]);

  useEffect(() => {
    let active = true;
    api
      .get<User>("/auth/me")
      .then((me) => active && setUser(me))
      .catch(() => active && setUser(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string, returnTo?: string | null) => {
      const signedIn = await api.post<User>("/auth/login", { email, password });
      setUser(signedIn);
      setSessionExpired(false);
      setAnnouncement("");
      router.replace(safeReturnPath(returnTo));
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Signed out locally anyway: the cookies expire on their own
    }
    setUser(null);
    setSessionExpired(false);
    router.replace("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      loading,
      sessionExpired,
      login,
      logout,
      refresh,
    }),
    [user, loading, sessionExpired, login, logout, refresh],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* Always in the page, so screen readers announce changes to it */}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}
