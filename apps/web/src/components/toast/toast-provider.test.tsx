/**
 * @jest-environment jsdom
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { ApiError } from "@/lib/api/errors";
import { expectNoAxeViolations } from "@/test/axe";
import { toastMessages } from "@/test/toasts";
import {
  TOAST_DURATION_MS,
  ToastProvider,
  useToast,
  type ToastApi,
} from "./toast-provider";

// A page with a field, handing the toast API to the test
let toast: ToastApi;
function Page({ grab }: { grab: (api: ToastApi) => void }) {
  const api = useToast();
  useEffect(() => grab(api), [api, grab]);
  return (
    <label>
      Nom
      <input />
    </label>
  );
}

function setup() {
  const view = render(
    <ToastProvider>
      <Page
        grab={(api) => {
          toast = api;
        }}
      />
    </ToastProvider>,
  );
  const ui = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  return { ui, ...view };
}

describe("ToastProvider", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("says a success politely, with an icon and words, then lets it go", () => {
    setup();
    act(() => toast.success("Équipe créée."));
    expect(toastMessages("polite")).toEqual(["Équipe créée."]);
    expect(toastMessages("error")).toEqual([]);
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(
      region.querySelector("[role=status] svg")?.getAttribute("aria-hidden"),
    ).toBe("true");
    expect(region.querySelector("[role=status] p")?.textContent).toBe(
      "Réussi : Équipe créée.",
    );

    act(() => jest.advanceTimersByTime(TOAST_DURATION_MS));
    expect(toastMessages("polite")).toEqual([]);
  });

  it("keeps a success while the pointer is on it", async () => {
    const { ui } = setup();
    act(() => toast.info("Tu es déconnecté."));
    await ui.hover(screen.getByText(/Tu es déconnecté/));
    act(() => jest.advanceTimersByTime(TOAST_DURATION_MS * 2));
    expect(toastMessages("polite")).toEqual(["Tu es déconnecté."]);
    await ui.unhover(screen.getByText(/Tu es déconnecté/));
    act(() => jest.advanceTimersByTime(TOAST_DURATION_MS));
    expect(toastMessages("polite")).toEqual([]);
  });

  it("keeps an error, read out at once, until it is dismissed", () => {
    setup();
    act(() => toast.error("La sauvegarde a échoué."));
    act(() => jest.advanceTimersByTime(TOAST_DURATION_MS * 10));
    expect(toastMessages("error")).toEqual(["La sauvegarde a échoué."]);
  });

  it("never takes the focus, and closes from the keyboard", async () => {
    const { ui } = setup();
    const field = screen.getByLabelText("Nom");
    await ui.click(field);
    act(() => toast.error("La sauvegarde a échoué."));
    // The user keeps typing where they were
    expect(document.activeElement).toBe(field);

    await ui.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", {
        name: "Fermer la notification : La sauvegarde a échoué.",
      }),
    );
    await ui.keyboard("{Enter}");
    expect(toastMessages("error")).toEqual([]);
  });

  it("closes with Escape while the focus is in it", async () => {
    const { ui } = setup();
    act(() => toast.error("Erreur un"));
    await ui.tab(); // the field
    await ui.tab(); // the close button
    await ui.keyboard("{Escape}");
    expect(toastMessages("error")).toEqual([]);
  });

  it("stacks toasts, keeping the latest four", () => {
    setup();
    act(() => {
      for (const n of [1, 2, 3, 4, 5]) toast.info(`Message ${n}`);
    });
    expect(toastMessages("polite")).toEqual([
      "Message 2",
      "Message 3",
      "Message 4",
      "Message 5",
    ]);
  });

  it("shows the same message once, however often it comes", () => {
    setup();
    act(() => {
      toast.error("Mot de passe incorrect.");
      toast.error("Mot de passe incorrect.");
      toast.error("Mot de passe incorrect.");
    });
    expect(toastMessages("error")).toEqual(["Mot de passe incorrect."]);
  });

  it("words an API error for the user", () => {
    setup();
    act(() =>
      toast.apiError(
        new ApiError(
          409,
          ["Match 1 is played"],
          {},
          "prediction_locked",
          "played",
        ),
      ),
    );
    expect(toastMessages("error")).toEqual([
      "Pronostic refusé : le match est déjà joué.",
    ]);
  });

  it("passes the axe checks with toasts of every kind", async () => {
    jest.useRealTimers();
    const { container } = setup();
    act(() => {
      toast.success("Équipe créée.");
      toast.info("Tu es déconnecté.");
      toast.error("La sauvegarde a échoué.");
    });
    await expectNoAxeViolations(container);
  });
});
