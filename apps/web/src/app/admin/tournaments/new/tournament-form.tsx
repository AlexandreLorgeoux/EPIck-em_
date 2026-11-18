"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Tournament } from "@/lib/api/models";
import { routes } from "@/lib/routes";

type Field = "name" | "game" | "description" | "startsAt" | "endsAt";

const fields: {
  name: Field;
  label: string;
  hint?: string;
  type: "text" | "textarea" | "datetime-local";
  required?: boolean;
}[] = [
  {
    name: "name",
    label: "Nom",
    hint: "Entre 3 et 80 caractères",
    type: "text",
    required: true,
  },
  {
    name: "game",
    label: "Jeu",
    hint: "Un jeu qui n'existe pas encore est créé",
    type: "text",
    required: true,
  },
  { name: "description", label: "Description", type: "textarea" },
  { name: "startsAt", label: "Début", type: "datetime-local" },
  { name: "endsAt", label: "Fin prévue", type: "datetime-local" },
];

// A datetime-local value is in the visitor's time zone, without offset
const toIso = (value: string) =>
  value ? new Date(value).toISOString() : undefined;

export function TournamentForm() {
  const router = useRouter();
  const baseId = useId();
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Takes keyboard and screen reader users to the first field to correct
  useEffect(() => {
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [errors]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: Field) => String(form.get(name) ?? "");
    setPending(true);
    setErrors({});
    setError("");
    try {
      const created = await api.post<Tournament>("/tournaments", {
        name: text("name"),
        game: text("game"),
        description: text("description") || undefined,
        startsAt: toIso(text("startsAt")),
        endsAt: toIso(text("endsAt")),
      });
      router.push(routes.admin.tournament(created.id));
    } catch (caught) {
      if (isApiError(caught) && caught.status === 400) {
        setErrors(
          Object.fromEntries(
            fields.map((f) => [f.name, caught.fieldError(f.name)]),
          ),
        );
      } else {
        setError(
          isApiError(caught)
            ? caught.message
            : "La création a échoué. Réessaie dans un instant.",
        );
      }
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <Link
        href={routes.admin.tournaments}
        className="underline underline-offset-4"
      >
        Retour aux tournois
      </Link>
      <h1 className="text-3xl font-bold">Créer un tournoi</h1>
      <p>
        Le tournoi est créé en brouillon : il reste invisible au public
        jusqu&apos;à la génération de l&apos;arbre.
      </p>

      <form
        ref={formRef}
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-4"
      >
        {fields.map((field) => {
          const id = `${baseId}-${field.name}`;
          const message = errors[field.name];
          const describedBy =
            [field.hint && `${id}-hint`, message && `${id}-error`]
              .filter(Boolean)
              .join(" ") || undefined;
          const props = {
            id,
            name: field.name,
            required: field.required,
            "aria-invalid": message ? true : undefined,
            "aria-describedby": describedBy,
            className: "min-h-11 rounded-md border-2 px-3",
          };
          return (
            <div key={field.name} className="flex flex-col gap-1">
              <label htmlFor={id} className="font-bold">
                {field.label}
                {!field.required && (
                  <span className="font-normal"> (facultatif)</span>
                )}
              </label>
              {field.hint && <p id={`${id}-hint`}>{field.hint}</p>}
              {field.type === "textarea" ? (
                <textarea
                  {...props}
                  rows={4}
                  className={`${props.className} py-2`}
                />
              ) : (
                <input {...props} type={field.type} />
              )}
              {message && <p id={`${id}-error`}>{message}</p>}
            </div>
          );
        })}

        {error && <p role="alert">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-md border-2 px-4 font-bold"
        >
          {pending ? "Création…" : "Créer le tournoi"}
        </button>
      </form>
    </div>
  );
}
