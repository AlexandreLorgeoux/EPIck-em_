import { screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/toast/toast-provider";

// Renders a screen inside the toast provider, as the root layout does
export const withToasts = (ui: ReactNode) => (
  <ToastProvider>{ui}</ToastProvider>
);

// The messages of the toasts on screen, oldest first: "polite" for
// success and info (role="status"), "error" for errors (role="alert")
export function toastMessages(kind: "polite" | "error") {
  const region = screen.getByRole("region", { name: "Notifications" });
  const live = within(region).getByRole(kind === "error" ? "alert" : "status");
  return [...live.querySelectorAll("p")].map((p) =>
    (p.textContent ?? "").replace(/^(Réussi|Erreur|Info) : /, ""),
  );
}
