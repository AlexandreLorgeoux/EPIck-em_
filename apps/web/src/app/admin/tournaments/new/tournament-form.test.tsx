/**
 * @jest-environment jsdom
 */
import { mockRouter } from "@/test/mock-navigation";
import { beforeEach, describe, expect, it } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "@/test/axe";
import { fakeApi } from "@/test/fake-api";
import { TournamentForm } from "./tournament-form";

describe("TournamentForm", () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
  });

  it("creates the tournament and opens its setup page", async () => {
    const fake = fakeApi({
      "POST /tournaments": [201, { id: "t1", name: "Winter Cup" }],
    });
    const ui = userEvent.setup();
    render(<TournamentForm />);

    await ui.type(screen.getByLabelText("Nom"), "Winter Cup");
    await ui.type(screen.getByLabelText("Jeu"), "Rocket League");
    await ui.type(screen.getByLabelText(/^Début/), "2026-12-05T14:00");
    await ui.click(screen.getByRole("button", { name: "Créer le tournoi" }));

    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith("/admin/tournaments/t1"),
    );
    expect(fake.calls[0].body).toEqual({
      name: "Winter Cup",
      game: "Rocket League",
      // Local time sent as an instant
      startsAt: new Date("2026-12-05T14:00").toISOString(),
    });
  });

  it("shows each error next to its field and focuses the first one", async () => {
    fakeApi({
      "POST /tournaments": [
        400,
        {
          message: ["name must be between 3 and 80 characters"],
          errors: {
            name: ["name must be between 3 and 80 characters"],
            endsAt: ["endsAt must be after startsAt"],
          },
        },
      ],
    });
    const ui = userEvent.setup();
    const { container } = render(<TournamentForm />);

    await ui.type(screen.getByLabelText("Nom"), "WC");
    await ui.click(screen.getByRole("button", { name: "Créer le tournoi" }));

    const name = screen.getByLabelText("Nom");
    await waitFor(() => expect(document.activeElement).toBe(name));
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(name.getAttribute("aria-describedby")).toContain("-error");
    // In French, with how to fix it
    expect(screen.getByText(/«Nom» doit faire/).textContent).toBe(
      "«Nom» doit faire entre 3 et 80 caractères. Tu en as saisi 2 : ajoute au moins 1 caractère.",
    );
    expect(
      screen.getByText(/«Fin prévue» doit être après «Début»/),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Jeu").getAttribute("aria-invalid"),
    ).toBeNull();
    expect(mockRouter.push).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });
});
