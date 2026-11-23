import { useId, type ReactNode } from "react";
import { FieldError } from "./messages";

export { controlClass } from "./styles";

// What a control needs to be tied to its label, hint and error
export interface ControlProps {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
}

/**
 * A labelled form control with its hint and error, linked for screen
 * readers (Oracup oc-field). The control itself is rendered by `children`:
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
    <div className="oc-field">
      <label htmlFor={id} className="oc-field__label">
        {label}
        {optional && <span className="font-normal"> (facultatif)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="oc-field__hint">
          {hint}
        </p>
      )}
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}
