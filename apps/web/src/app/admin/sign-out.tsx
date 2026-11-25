"use client";

import { buttonClass } from "@/components/styles";
import { useToast } from "@/components/toast/toast-provider";
import { useAuth } from "@/lib/auth/auth-provider";

export function SignOut() {
  const { user, logout } = useAuth();
  const toast = useToast();
  return (
    <div className="flex flex-wrap items-center gap-3">
      {user && (
        <span className="body-sm text-ink-soft">
          Connecté en tant que {user.displayName}
        </span>
      )}
      <button
        type="button"
        onClick={async () => {
          await logout();
          toast.info("Tu es déconnecté.");
        }}
        className={buttonClass}
      >
        Se déconnecter
      </button>
    </div>
  );
}
