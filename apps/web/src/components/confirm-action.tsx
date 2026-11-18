"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export const buttonClass =
  "min-h-11 rounded-md border-2 px-4 font-bold disabled:opacity-50";

/**
 * A button that asks for confirmation in place before an action that
 * cannot be undone. Focus moves to the question, and back to the button
 * on cancel, so keyboard users never lose their place.
 */
export function ConfirmAction({
  label,
  question,
  confirmLabel,
  children,
  disabled = false,
  onConfirm,
}: {
  label: string;
  question: string;
  confirmLabel: string;
  // What will happen, shown under the question
  children?: ReactNode;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Set on cancel: the button is back only after the next render
  const returnFocus = useRef(false);

  useEffect(() => {
    if (open) headingRef.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return (
      <button
        ref={buttonRef}
        type="button"
        className={`${buttonClass} self-start`}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
    );
  }
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-md border-2 p-4"
    >
      <h3
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-bold"
      >
        {question}
      </h3>
      {children}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            setOpen(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            returnFocus.current = true;
            setOpen(false);
          }}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
