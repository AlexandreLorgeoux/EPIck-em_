"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ErrorMessage, FieldError } from "@/components/messages";
import { primaryButtonClass } from "@/components/styles";
import { useToast } from "@/components/toast/toast-provider";
import { isApiError } from "@/lib/api/errors";
import { SESSION_EXPIRED_MESSAGE, useAuth } from "@/lib/auth/auth-provider";

type FieldErrors = { email?: string; password?: string };

export function LoginForm() {
  const { login, sessionExpired } = useAuth();
  const toast = useToast();
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
      toast.success("Te voilà connecté.");
    } catch (caught) {
      // A 401 here is wrong credentials, not an expired session
      if (isApiError(caught) && caught.status === 401) {
        const message =
          "E-mail ou mot de passe incorrect. Vérifie-les et réessaie.";
        setError(message);
        toast.error(message);
      } else if (isApiError(caught) && caught.status === 400) {
        setFieldErrors({
          email: caught.fieldError("email"),
          password: caught.fieldError("password"),
        });
        toast.apiError(caught);
      } else {
        const message = isApiError(caught)
          ? caught.message
          : "La connexion a échoué. Réessaie dans un instant.";
        setError(message);
        toast.error(message);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <h1 ref={headingRef} tabIndex={-1} className="display">
        Connexion
      </h1>
      {sessionExpired && <p className="body-lg">{SESSION_EXPIRED_MESSAGE}</p>}

      <form onSubmit={onSubmit} noValidate className="oc-card gap-4">
        <div className="oc-field">
          <label htmlFor={ids.email} className="oc-field__label">
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
            className="oc-field__input"
          />
          {fieldErrors.email && (
            <FieldError id={`${ids.email}-error`}>
              {fieldErrors.email}
            </FieldError>
          )}
        </div>

        <div className="oc-field">
          <label htmlFor={ids.password} className="oc-field__label">
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
            className="oc-field__input"
          />
          {fieldErrors.password && (
            <FieldError id={`${ids.password}-error`}>
              {fieldErrors.password}
            </FieldError>
          )}
        </div>

        {error && <ErrorMessage announce={false}>{error}</ErrorMessage>}

        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
