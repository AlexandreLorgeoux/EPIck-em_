/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Scoring } from "@/lib/api/models";
import { expectNoAxeViolations } from "@/test/axe";
import { fakeApi } from "@/test/fake-api";
import { toastMessages, withToasts } from "@/test/toasts";
import { ScoringForm } from "./scoring-form";

const defaults: Scoring = {
  pointsCorrectPick: 3,
  exactScoreBonus: 2,
  roundIncrement: 1,
  isDefault: true,
  updatedAt: null,
};

function setup() {
  const fake = fakeApi({ "GET /tournaments/t1/scoring": [200, defaults] });
  const view = render(withToasts(<ScoringForm tournamentId="t1" />));
  return { fake, ui: userEvent.setup(), ...view };
}

const winner = () => screen.findByLabelText("Points pour le bon vainqueur");
const round = () => screen.getByLabelText("Points en plus à chaque tour");
const bonus = () => screen.getByLabelText("Bonus pour le score exact");
const save = () =>
  screen.getByRole("button", { name: "Enregistrer le barème" });

describe("ScoringForm", () => {
  it("starts from the current points, with an example that follows", async () => {
    const { container, ui } = setup();
    const points = (await winner()) as HTMLInputElement;
    expect(points.value).toBe("3");
    expect(screen.getByText(/Barème par défaut/)).toBeTruthy();
    expect(
      screen.getByText(
        "Exemple : tour 1 : 3 points, tour 2 : 4 points, tour 3 : 5 points. Score exact : +2.",
      ),
    ).toBeTruthy();
    await ui.clear(points);
    expect(screen.queryByText(/^Exemple/)).toBeNull();
    await ui.type(points, "10");
    expect(screen.getByText(/tour 1 : 10 points/)).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it("saves the points and says so", async () => {
    const { fake, ui } = setup();
    await ui.clear(await winner());
    await ui.type(await winner(), "5");
    await ui.clear(bonus());
    await ui.type(bonus(), "0");
    fake.set("PUT /tournaments/t1/scoring", [
      200,
      {
        ...defaults,
        pointsCorrectPick: 5,
        exactScoreBonus: 0,
        isDefault: false,
      },
    ]);
    await ui.click(save());
    await waitFor(() =>
      expect(toastMessages("polite")).toEqual([
        "Barème enregistré : les pronostics déjà joués sont recalculés.",
      ]),
    );
    expect(fake.calls.at(-1)?.body).toEqual({
      pointsCorrectPick: 5,
      exactScoreBonus: 0,
      roundIncrement: 1,
    });
    expect(screen.getByText(/Barème choisi pour ce tournoi/)).toBeTruthy();
  });

  it("links each error to its field with a fix, and focuses the first", async () => {
    const { container, fake, ui } = setup();
    await ui.clear(await winner());
    await ui.type(await winner(), "-1");
    await ui.clear(round());
    await ui.type(round(), "1.5");
    await ui.clear(bonus());
    fake.set("PUT /tournaments/t1/scoring", [
      400,
      {
        message: ["invalid"],
        errors: {
          pointsCorrectPick: ["pointsCorrectPick must be 0 or more"],
          roundIncrement: ["roundIncrement must be a whole number of points"],
          exactScoreBonus: ["exactScoreBonus must be 100 or less"],
        },
      },
    ]);
    await ui.click(save());
    await waitFor(async () =>
      expect((await winner()).getAttribute("aria-invalid")).toBe("true"),
    );
    const errorOf = (input: HTMLElement) =>
      input
        .getAttribute("aria-describedby")!
        .split(" ")
        .map((id) => document.getElementById(id)?.textContent)
        .at(-1);
    expect(errorOf(await winner())).toContain("Remplace -1 par 0 ou plus.");
    expect(errorOf(round())).toContain("Remplace 1,5 par 1 ou 2.");
    expect(errorOf(bonus())).toContain("Saisis un nombre");
    expect(document.activeElement).toBe(await winner());
    // An empty field is reported, not saved as 0
    expect(fake.calls.at(-1)?.body).toMatchObject({ exactScoreBonus: null });
    // What was typed stays
    expect((round() as HTMLInputElement).value).toBe("1.5");
    await expectNoAxeViolations(container);
  });

  it("explains a loading error and retries", async () => {
    const fake = fakeApi({
      "GET /tournaments/t1/scoring": [500, { message: "Internal" }],
    });
    render(withToasts(<ScoringForm tournamentId="t1" />));
    await screen.findByText(/Le serveur a rencontré un problème/);
    fake.set("GET /tournaments/t1/scoring", [200, defaults]);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await winner()).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Barème des pronostics" }),
    );
  });
});
