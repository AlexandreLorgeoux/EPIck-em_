"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./brand/icon";
import { buttonClass } from "./styles";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';

/**
 * A window over the page. Render it to open it, remove it to close it. The
 * browser makes the rest of the page inert (<dialog>); Tab is kept inside,
 * Escape closes, and focus returns to what opened it.
 */
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    if (dialog && !dialog.open) dialog.showModal();
    titleRef.current?.focus();
    return () => {
      dialog?.close();
      opener?.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-md border-2 border-border-ui bg-surface-raised p-4 text-ink backdrop:bg-black/60 sm:p-6"
      // The browser's own Escape: closing stays up to the parent
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key !== "Tab") return;
        const items = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE),
        ];
        const first = items[0];
        const last = items.at(-1);
        const current = document.activeElement;
        if (event.shiftKey) {
          // The title has focus at first, before any control
          if (current === first || current === titleRef.current) {
            event.preventDefault();
            last?.focus();
          }
        } else if (current === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} ref={titleRef} tabIndex={-1} className="title">
            {title}
          </h2>
          <button type="button" className={buttonClass} onClick={onClose}>
            <Icon name="close" />
            Fermer
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
