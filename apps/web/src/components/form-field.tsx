import { useId, type ReactNode } from "react";

// What a control needs to be tied to its label, hint and error
export interface ControlProps {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
}

export const controlClass = "min-h-11 rounded-md border-2 px-3";

/**
 * A labelled form control with its hint and error, linked for screen
 * readers. The control itself is rendered by `children`:
 *
 *   <FormField label="Nom" error={errors.name}>
 *     {(props) => <input {...props} name="name" className={controlClass} />}
 *   </FormField>
 */
export function FormField({
  label,
  hint,
  error,
  optional = false,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: (props: ControlProps) => ReactNode;
}) {
  const id = useId();
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-bold">
        {label}
        {optional && <span className="font-normal"> (facultatif)</span>}
      </label>
      {hint && <p id={`${id}-hint`}>{hint}</p>}
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {error && (
        <p id={`${id}-error`} className="font-bold">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}
    </div>
  );
}
