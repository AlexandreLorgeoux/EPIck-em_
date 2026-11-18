"use client";

import { useAuth } from "@/lib/auth/auth-provider";

export function SignOut() {
  const { user, logout } = useAuth();
  return (
    <div className="flex flex-wrap items-center gap-3">
      {user && <span>Connecté en tant que {user.displayName}</span>}
      <button
        type="button"
        onClick={() => logout()}
        className="min-h-11 rounded-md border-2 px-4 font-bold"
      >
        Se déconnecter
      </button>
    </div>
  );
}
