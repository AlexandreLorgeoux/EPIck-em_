"use client";

import { buttonClass } from "@/components/styles";
import { useAuth } from "@/lib/auth/auth-provider";

export function SignOut() {
  const { user, logout } = useAuth();
  return (
    <div className="flex flex-wrap items-center gap-3">
      {user && (
        <span className="body-sm text-ink-soft">
          Connecté en tant que {user.displayName}
        </span>
      )}
      <button type="button" onClick={() => logout()} className={buttonClass}>
        Se déconnecter
      </button>
    </div>
  );
}
