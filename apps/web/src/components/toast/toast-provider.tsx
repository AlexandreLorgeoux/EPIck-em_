"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "@/components/brand/icon";
import { apiErrorMessage } from "./api-error-message";

export type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  // An error toast worded from what the API answered (apiErrorMessage)
  apiError: (caught: unknown, fallback?: string) => void;
}

// Success and info fade after 5 s; errors stay until dismissed
export const TOAST_DURATION_MS = 5000;
// Older toasts go when more pile up, so the stack never hides the page
const MAX_TOASTS = 4;

const kinds: Record<
  ToastKind,
  { icon: IconName; label: string; border: string }
> = {
  success: { icon: "check", label: "Réussi", border: "border-brand" },
  error: { icon: "close", label: "Erreur", border: "border-loss" },
  info: { icon: "info", label: "Info", border: "border-border-ui" },
};

// Outside a provider (a component rendered alone), toasts are dropped
const noop = () => {};
const ToastContext = createContext<ToastApi>({
  success: noop,
  error: noop,
  info: noop,
  apiError: noop,
});

/**
 * Toasts: short feedback after an action, success or failure. Render the
 * provider once, around the app; call useToast() anywhere below it.
 *
 *   const toast = useToast();
 *   toast.success("Équipe créée.");
 *   toast.apiError(caught);
 *
 * Not for live updates pushed by the server: those go through the page's
 * own polite aria-live region (docs/web-toasts.md).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++nextId.current;
    // The same message again replaces the old one instead of piling up
    setToasts((list) =>
      [
        ...list.filter((t) => t.kind !== kind || t.message !== message),
        { id, kind, message },
      ].slice(-MAX_TOASTS),
    );
  }, []);

  // The page keeps room at its bottom for the stack, so whatever the toasts
  // cover can still be scrolled into view above them (200 % zoom, phones)
  const region = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    const element = region.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const height = element.getBoundingClientRect().height;
      root.style.setProperty(
        "--toast-space",
        height > 0 ? `${Math.ceil(height) + 16}px` : "0px",
      );
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--toast-space");
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
      apiError: (caught, fallback) =>
        push("error", apiErrorMessage(caught, fallback)),
    }),
    [push],
  );

  const polite = toasts.filter((t) => t.kind !== "error");
  const errors = toasts.filter((t) => t.kind === "error");

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section
        ref={region}
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-20 flex max-h-[45vh] flex-col gap-2 overflow-y-auto sm:left-auto sm:w-96"
      >
        {/* Always in the page, so a screen reader hears what is added:
            errors at once, the rest when it is free */}
        <div role="alert" className="flex flex-col gap-2">
          {errors.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
        <div role="status" className="flex flex-col gap-2">
          {polite.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
      </section>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const { icon, label, border } = kinds[toast.kind];
  const [paused, setPaused] = useState(false);

  // Fades on its own unless it is an error, or the user is reading it
  // (pointer over it, or keyboard focus inside)
  useEffect(() => {
    if (toast.kind === "error" || paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, paused, onDismiss]);

  return (
    <div
      className={`oc-toast pointer-events-auto flex items-start gap-3 rounded-md border-2 border-l-8 bg-surface-raised p-3 text-ink ${border}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") onDismiss(toast.id);
      }}
    >
      <span className={toast.kind === "error" ? "text-loss" : "text-brand"}>
        <Icon name={icon} />
      </span>
      <p className="grow">
        <span className="sr-only">{label} : </span>
        {toast.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="oc-btn oc-btn--secondary min-h-11 px-3"
        aria-label={`Fermer la notification : ${toast.message}`}
      >
        <Icon name="close" />
      </button>
    </div>
  );
}

export const useToast = () => useContext(ToastContext);
