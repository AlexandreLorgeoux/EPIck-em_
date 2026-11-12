"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { isApiError } from "@/lib/api/errors";
import { SESSION_EXPIRED_MESSAGE, useAuth } from "@/lib/auth/auth-provider";

type FieldErrors = { email?: string; password?: string };

export function LoginForm() {
  const { login, sessionExpired } = useAuth();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const ids = { email: useId(), password: useId(), error: useId() };

  // After an expired session, start keyboard and screen reader users here
  useEffect(() => {
    if (sessionExpired) headingRef.current?.focus();
  }, [sessionExpired]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    // Read here rather than with useSearchParams, which would keep the whole
    // form out of the server-rendered HTML until JavaScript has loaded
    const returnTo = new URLSearchParams(window.location.search).get("next");
    setPending(true);
    setError("");
    setFieldErrors({});
    try {
      await login(
        String(form.get("email") ?? ""),
        String(form.get("password") ?? ""),
        returnTo,
      );
    } catch (caught) {
      if (isApiError(caught) && caught.status === 401) {
        setError("E-mail ou mot de passe incorrect. Vérifie-les et réessaie.");
      } else if (isApiError(caught) && caught.status === 400) {
        setFieldErrors({
          email: caught.fieldError("email"),
          password: caught.fieldError("password"),
        });
      } else {
        setError(
          isApiError(caught)
            ? caught.message
            : "La connexion a échoué. Réessaie dans un instant.",
        );
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-bold">
        Connexion
      </h1>
      {sessionExpired && <p>{SESSION_EXPIRED_MESSAGE}</p>}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.email} className="font-bold">
            Adresse e-mail
          </label>
          <input
            id={ids.email}
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={
              fieldErrors.email ? `${ids.email}-error` : undefined
            }
            className="min-h-11 rounded-md border-2 px-3"
          />
          {fieldErrors.email && (
            <p id={`${ids.email}-error`}>{fieldErrors.email}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={ids.password} className="font-bold">
            Mot de passe
          </label>
          <input
            id={ids.password}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={
              fieldErrors.password ? `${ids.password}-error` : undefined
            }
            className="min-h-11 rounded-md border-2 px-3"
          />
          {fieldErrors.password && (
            <p id={`${ids.password}-error`}>{fieldErrors.password}</p>
          )}
        </div>

        {error && (
          <p id={ids.error} role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-md border-2 px-4 font-bold"
        >
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
