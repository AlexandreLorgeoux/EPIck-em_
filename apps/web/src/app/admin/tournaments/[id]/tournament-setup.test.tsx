/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from "@jest/globals";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Tournament, TournamentTeam } from "@/lib/api/models";
import { expectNoAxeViolations } from "@/test/axe";
import { fakeApi } from "@/test/fake-api";
import { TournamentSetup } from "./tournament-setup";

const draft: Tournament = {
  id: "t1",
  slug: "winter-cup",
  name: "Winter Cup",
  game: { id: "g1", name: "Rocket League" },
  description: null,
  startsAt: null,
  endsAt: null,
  timezone: "Europe/Paris",
  status: "draft",
  owner: { id: "u1", displayName: "admin" },
};

const entry = (name: string, seed: number | null = null): TournamentTeam => ({
  id: `id-${name}`,
  name,
  tag: null,
  seed,
});

const teamsOf = (...names: string[]) =>
  names.map((name) => ({
    id: `id-${name}`,
    name,
    tag: null,
    captainPlayerId: null,
    members: [],
  }));

// A draft with the given teams in it, out of Alpha, Bravo, Charlie and Delta
function setup(inTournament: TournamentTeam[], tournament = draft) {
  const fake = fakeApi({
    "GET /tournaments/t1": [200, tournament],
    "GET /tournaments/t1/teams": [200, inTournament],
    "GET /teams": [200, teamsOf("Alpha", "Bravo", "Charlie", "Delta")],
  });
  const view = render(<TournamentSetup id="t1" />);
  return { fake, ui: userEvent.setup(), ...view };
}

const listed = () =>
  within(screen.getByRole("list"))
    .getAllByRole("listitem")
    .map((item) => item.firstChild?.textContent);

describe("TournamentSetup", () => {
  it("shows the status in words", async () => {
    setup([]);
    const status = await screen.findByText("Statut :");
    expect(status.parentElement?.textContent).toBe("Statut : Brouillon");
  });

  it("adds a team and only offers teams not in yet", async () => {
    const { fake, ui } = setup([entry("Alpha")]);
    const select = await screen.findByLabelText("Équipe à ajouter");
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Bravo", "Charlie", "Delta"]);

    fake.set("POST /tournaments/t1/teams", [
      201,
      [entry("Alpha"), entry("Charlie")],
    ]);
    await ui.selectOptions(select, "Charlie");
    await ui.click(screen.getByRole("button", { name: "Ajouter" }));

    await waitFor(() => expect(listed()).toEqual(["Alpha", "Charlie"]));
    expect(fake.calls.at(-1)?.body).toEqual({ teamId: "id-Charlie" });
    expect(screen.getByRole("status").textContent).toBe(
      "Charlie ajoutée au tournoi.",
    );
  });

  it("removes a team", async () => {
    const { fake, ui } = setup([entry("Alpha"), entry("Bravo")]);
    const remove = await screen.findByRole("button", {
      name: "Retirer Alpha",
    });
    fake.set("DELETE /tournaments/t1/teams/id-Alpha", [204]);
    fake.set("GET /tournaments/t1/teams", [200, [entry("Bravo")]]);
    await ui.click(remove);

    await waitFor(() => expect(listed()).toEqual(["Bravo"]));
    expect(fake.count("DELETE /tournaments/t1/teams/id-Alpha")).toBe(1);
  });

  it("orders the seeds by hand, then saves them and generates after confirmation", async () => {
    const { fake, ui } = setup([
      entry("Alpha"),
      entry("Bravo"),
      entry("Charlie"),
    ]);
    await ui.click(await screen.findByLabelText(/^Manuel/));
    await ui.click(screen.getByRole("button", { name: "Monter Charlie" }));
    await ui.click(screen.getByRole("button", { name: "Monter Charlie" }));
    expect(listed()).toEqual(["1. Charlie", "2. Alpha", "3. Bravo"]);
    expect(screen.getByRole("status").textContent).toBe(
      "Charlie est tête de série 1.",
    );

    await ui.click(screen.getByRole("button", { name: "Générer l'arbre" }));
    // Nothing is sent before the confirmation
    expect(fake.count("POST /tournaments/t1/bracket")).toBe(0);
    const confirm = screen.getByRole("group", {
      name: "Générer l'arbre et démarrer le tournoi ?",
    });
    expect(document.activeElement).toBe(within(confirm).getByRole("heading"));

    const seeded = [entry("Charlie", 1), entry("Alpha", 2), entry("Bravo", 3)];
    fake.set("PUT /tournaments/t1/seeding", [200, seeded]);
    fake.set("POST /tournaments/t1/bracket", [201, {}]);
    fake.set("GET /tournaments/t1", [200, { ...draft, status: "running" }]);
    fake.set("GET /tournaments/t1/teams", [200, seeded]);
    await ui.click(
      screen.getByRole("button", { name: "Confirmer la génération" }),
    );

    await waitFor(() =>
      expect(screen.getByText("Statut :").parentElement?.textContent).toBe(
        "Statut : En cours",
      ),
    );
    expect(
      fake.calls
        .filter((c) => c.route.startsWith("P"))
        .map((c) => [c.route, c.body]),
    ).toEqual([
      [
        "PUT /tournaments/t1/seeding",
        { teamIds: ["id-Charlie", "id-Alpha", "id-Bravo"] },
      ],
      ["POST /tournaments/t1/bracket", { seeding: "manual" }],
    ]);
    // Frozen once started: no more changes offered
    expect(screen.queryByRole("button", { name: /Retirer/ })).toBeNull();
    expect(screen.queryByLabelText("Équipe à ajouter")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "Arbre généré : le tournoi est en cours.",
    );
  });

  it("draws the seeds when seeding is automatic", async () => {
    const { fake, ui } = setup([entry("Alpha"), entry("Bravo")]);
    fake.set("POST /tournaments/t1/bracket", [201, {}]);
    await ui.click(
      await screen.findByRole("button", { name: "Générer l'arbre" }),
    );
    await ui.click(
      screen.getByRole("button", { name: "Confirmer la génération" }),
    );
    await waitFor(() =>
      expect(fake.count("POST /tournaments/t1/bracket")).toBe(1),
    );
    expect(fake.calls.find((c) => c.route.startsWith("POST"))?.body).toEqual({
      seeding: "auto",
    });
    expect(fake.count("PUT /tournaments/t1/seeding")).toBe(0);
  });

  it("cancels the generation and returns to the button", async () => {
    const { fake, ui } = setup([entry("Alpha"), entry("Bravo")]);
    await ui.click(
      await screen.findByRole("button", { name: "Générer l'arbre" }),
    );
    await ui.click(screen.getByRole("button", { name: "Annuler" }));

    const generate = screen.getByRole("button", { name: "Générer l'arbre" });
    await waitFor(() => expect(document.activeElement).toBe(generate));
    expect(fake.count("POST /tournaments/t1/bracket")).toBe(0);
  });

  it("needs two teams before generating", async () => {
    setup([entry("Alpha")]);
    const generate = await screen.findByRole("button", {
      name: "Générer l'arbre",
    });
    expect(generate).toHaveProperty("disabled", true);
    expect(
      screen.getByText("Il faut au moins 2 équipes pour générer l'arbre."),
    ).toBeTruthy();
  });

  it("explains a refused change", async () => {
    const { fake, ui } = setup([entry("Alpha"), entry("Bravo")]);
    fake.set("POST /tournaments/t1/bracket", [
      409,
      {
        message:
          "This tournament is running: only a draft tournament can be started",
      },
    ]);
    await ui.click(
      await screen.findByRole("button", { name: "Générer l'arbre" }),
    );
    await ui.click(
      screen.getByRole("button", { name: "Confirmer la génération" }),
    );
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Ce tournoi est en cours : seul un brouillon peut encore changer.",
    );
  });

  it("shows the seeds of a started tournament, read-only", async () => {
    setup([entry("Bravo", 1), entry("Alpha", 2)], {
      ...draft,
      status: "running",
    });
    await screen.findByText(
      "Le tournoi a démarré : les équipes et le seeding ne peuvent plus changer.",
    );
    expect(listed()).toEqual(["1. Bravo", "2. Alpha"]);
    expect(
      screen.queryByRole("button", { name: "Générer l'arbre" }),
    ).toBeNull();
  });

  it("passes the axe checks, manual seeding and confirmation shown", async () => {
    const { ui, container } = setup([entry("Alpha"), entry("Bravo")]);
    await ui.click(await screen.findByLabelText(/^Manuel/));
    await ui.click(screen.getByRole("button", { name: "Générer l'arbre" }));
    await expectNoAxeViolations(container);
  });
});
