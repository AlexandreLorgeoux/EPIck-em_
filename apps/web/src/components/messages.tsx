import type { ReactNode } from "react";
import { Icon } from "./brand/icon";

// An error tied to a field: the icon and the color help, the words say it
export function FieldError({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <p id={id} className="oc-field__error">
      <Icon name="close" />
      <span>{children}</span>
    </p>
  );
}

// An error about the whole screen or form, read out as soon as it shows
export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="oc-field__error">
      <Icon name="close" />
      <span>{children}</span>
    </p>
  );
}
