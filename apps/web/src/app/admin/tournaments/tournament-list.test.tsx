/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from "@jest/globals";
import { render, screen, within } from "@testing-library/react";
import type { Tournament } from "@/lib/api/models";
import { expectNoAxeViolations } from "@/test/axe";
import { fakeApi } from "@/test/fake-api";
import { TournamentList } from "./tournament-list";

const tournament = (name: string, status: Tournament["status"]) =>
  ({
    id: `id-${name}`,
    slug: name.toLowerCase(),
    name,
    game: { id: "g1", name: "Rocket League" },
    description: null,
    startsAt: null,
    endsAt: null,
    timezone: "Europe/Paris",
    status,
    owner: { id: "u1", displayName: "admin" },
  }) satisfies Tournament;

describe("TournamentList", () => {
  it("lists every tournament with its status written out", async () => {
    fakeApi({
      "GET /tournaments": [
        200,
        [
          tournament("Winter Cup", "draft"),
          tournament("Spring Cup", "running"),
          tournament("Autumn Cup", "finished"),
        ],
      ],
    });
    render(<TournamentList />);

    const rows = await screen.findAllByRole("row");
    // Header row, then one row per tournament
    expect(
      rows
        .slice(1)
        .map((row) => [
          within(row).getByRole("link").textContent,
          row.lastElementChild?.textContent,
        ]),
    ).toEqual([
      ["Winter Cup", "Brouillon"],
      ["Spring Cup", "En cours"],
      ["Autumn Cup", "Terminé"],
    ]);
    expect(
      screen.getByRole("link", { name: "Winter Cup" }).getAttribute("href"),
    ).toBe("/admin/tournaments/id-Winter Cup");
    expect(screen.getByRole("link", { name: "Créer un tournoi" })).toBeTruthy();
  });

  it("invites to create the first tournament when there is none", async () => {
    fakeApi({ "GET /tournaments": [200, []] });
    render(<TournamentList />);
    expect(
      await screen.findByText("Aucun tournoi pour l'instant. Crée le premier."),
    ).toBeTruthy();
  });

  it("says when the list cannot be loaded", async () => {
    fakeApi({
      "GET /tournaments": [500, { message: "Internal server error" }],
    });
    render(<TournamentList />);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Internal server error",
    );
  });

  it("passes the axe checks", async () => {
    fakeApi({
      "GET /tournaments": [200, [tournament("Winter Cup", "running")]],
    });
    const { container } = render(<TournamentList />);
    await screen.findByRole("link", { name: "Winter Cup" });
    await expectNoAxeViolations(container);
  });
});
