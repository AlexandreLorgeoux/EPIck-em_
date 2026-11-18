"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { isApiError } from "@/lib/api/errors";
import { explainFieldError, explainMessage } from "./explain";

export type FormValues = Record<string, string>;

/**
 * Submits a form to the API and turns its errors into French messages:
 * per field when the API names one of the form's fields, for the whole
 * form otherwise. After an error, focus moves to the first field to fix.
 *
 *   const form = useApiForm({ name: "Nom", tag: "Tag" });
 *   <form id={form.id} onSubmit={form.onSubmit(async (values) => …)}>
 */
export function useApiForm(labels: Record<string, string>) {
  const id = useId();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    document
      .getElementById(id)
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [id, fieldErrors]);

  const onSubmit =
    (action: (values: FormValues) => Promise<void>) =>
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const values: FormValues = {};
      new FormData(event.currentTarget).forEach((value, key) => {
        values[key] = String(value);
      });
      setPending(true);
      setFieldErrors({});
      setFormError("");
      try {
        await action(values);
      } catch (caught) {
        if (!isApiError(caught)) {
          setFormError("L'enregistrement a échoué. Réessaie dans un instant.");
          return;
        }
        const onFields: Record<string, string> = {};
        const elsewhere: string[] = [];
        for (const [field, messages] of Object.entries(caught.fieldErrors)) {
          if (field in labels) {
            onFields[field] = explainFieldError(field, messages[0], {
              labels,
              values,
            });
          } else {
            elsewhere.push(...messages.map(explainMessage));
          }
        }
        if (!Object.keys(caught.fieldErrors).length) {
          elsewhere.push(explainMessage(caught.message));
        }
        setFieldErrors(onFields);
        setFormError(elsewhere.join(" "));
      } finally {
        setPending(false);
      }
    };

  return { id, fieldErrors, formError, pending, onSubmit };
}
