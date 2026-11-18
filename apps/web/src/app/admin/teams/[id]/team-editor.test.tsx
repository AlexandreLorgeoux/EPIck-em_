/**
 * @jest-environment jsdom
 */
import { mockRouter } from "@/test/mock-navigation";
import { beforeEach, describe, expect, it } from "@jest/globals";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Player, Team } from "@/lib/api/models";
import { expectNoAxeViolations } from "@/test/axe";
import { fakeApi } from "@/test/fake-api";
import { TeamEditor } from "./team-editor";

const member = (id: string, handle: string) => ({
  id,
  handle,
  isSubstitute: false,
  role: null,
  joinedOn: "2026-11-01",
});

const team: Team = {
  id: "t1",
  name: "Marmottes",
  tag: "MRM",
  captainPlayerId: null,
  members: [member("p1", "Kestrel")],
};

const player = (id: string, handle: string, teamName?: string): Player => ({
  id,
  handle,
  userId: null,
  team: teamName
    ? { id: "tx", name: teamName, tag: null, isSubstitute: false, role: null }
    : null,
});

const players = [
  player("p1", "Kestrel", "Marmottes"),
  player("p2", "Brindille"),
  player("p3", "Galet", "Quokkas"),
  player("p4", "Mistral"),
];

function setup(current: Team = team) {
  const fake = fakeApi({
    "GET /teams/t1": [200, current],
    "GET /players": [200, players],
  });
  const view = render(<TeamEditor id="t1" />);
  return { fake, ui: userEvent.setup(), ...view };
}

const memberNames = () =>
  within(screen.getByRole("region", { name: /^Joueurs/ }))
    .queryAllByRole("listitem")
    .map((item) => item.firstChild?.textContent);

describe("TeamEditor", () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
  });

  it("only offers players without a team", async () => {
    setup();
    const select = await screen.findByLabelText("Joueur");
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Brindille", "Mistral"]);
  });

  it("adds a substitute with a role", async () => {
    const { fake, ui } = setup();
    await ui.selectOptions(await screen.findByLabelText("Joueur"), "Mistral");
    await ui.type(screen.getByLabelText(/^Rôle/), "Gardien");
    await ui.click(screen.getByLabelText("Remplaçant"));
    fake.set("POST /teams/t1/members", [
      201,
      {
        ...team,
        members: [
          member("p1", "Kestrel"),
          { ...member("p4", "Mistral"), isSubstitute: true, role: "Gardien" },
        ],
      },
    ]);
    await ui.click(screen.getByRole("button", { name: "Ajouter le joueur" }));

    await waitFor(() =>
      expect(memberNames()).toEqual([
        "Kestrel",
        "Mistral · remplaçant · Gardien",
      ]),
    );
    expect(
      fake.calls.find((c) => c.route === "POST /teams/t1/members")?.body,
    ).toEqual({ playerId: "p4", isSubstitute: true, role: "Gardien" });
    expect(screen.getByRole("status").textContent).toBe(
      "Mistral ajouté à l'équipe.",
    );
  });

  it("removes a member", async () => {
    const { fake, ui } = setup();
    const remove = await screen.findByRole("button", {
      name: "Retirer Kestrel",
    });
    fake.set("DELETE /teams/t1/members/p1", [200, { ...team, members: [] }]);
    await ui.click(remove);
    await waitFor(() => expect(memberNames()).toEqual([]));
    expect(screen.getByText("Aucun joueur dans cette équipe.")).toBeTruthy();
  });

  it("names the captain", async () => {
    const { fake, ui } = setup();
    await ui.selectOptions(
      await screen.findByLabelText("Capitaine"),
      "Kestrel",
    );
    fake.set("PATCH /teams/t1", [200, { ...team, captainPlayerId: "p1" }]);
    await ui.click(
      screen.getByRole("button", { name: "Changer de capitaine" }),
    );

    await waitFor(() => expect(memberNames()).toEqual(["Kestrel · capitaine"]));
    expect(fake.calls.at(-1)?.body).toEqual({ captainPlayerId: "p1" });
  });

  it("renames the team and removes its tag", async () => {
    const { fake, ui } = setup();
    const name = await screen.findByLabelText("Nom");
    await ui.clear(name);
    await ui.type(name, "Marmottes Royales");
    await ui.clear(screen.getByLabelText(/^Tag/));
    fake.set("PATCH /teams/t1", [
      200,
      { ...team, name: "Marmottes Royales", tag: null },
    ]);
    await ui.click(screen.getByRole("button", { name: "Enregistrer" }));

    await screen.findByRole("heading", { level: 1, name: "Marmottes Royales" });
    expect(fake.calls.at(-1)?.body).toEqual({
      name: "Marmottes Royales",
      tag: null,
    });
  });

  it("deletes the team after a confirmation", async () => {
    const { fake, ui } = setup();
    await ui.click(
      await screen.findByRole("button", { name: "Supprimer l'équipe" }),
    );
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Supprimer Marmottes ?" }),
    );
    expect(fake.count("DELETE /teams/t1")).toBe(0);

    fake.set("DELETE /teams/t1", [204]);
    await ui.click(
      screen.getByRole("button", { name: "Supprimer définitivement" }),
    );
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith("/admin/teams"),
    );
  });

  it("explains in French why a registered team cannot be deleted", async () => {
    const { fake, ui } = setup();
    fake.set("DELETE /teams/t1", [
      409,
      {
        message:
          "This team is registered in 1 tournament(s): withdraw the registrations before deleting the team",
      },
    ]);
    await ui.click(
      await screen.findByRole("button", { name: "Supprimer l'équipe" }),
    );
    await ui.click(
      screen.getByRole("button", { name: "Supprimer définitivement" }),
    );
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Cette équipe est inscrite à 1 tournoi : retire-la de ce tournoi avant de supprimer.",
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("cancels the deletion with the keyboard and returns to the button", async () => {
    const { ui } = setup();
    const button = await screen.findByRole("button", {
      name: "Supprimer l'équipe",
    });
    button.focus();
    await ui.keyboard("{Enter}");
    // From the question: confirm, then cancel
    await ui.tab();
    await ui.tab();
    expect(document.activeElement?.textContent).toBe("Annuler");
    await ui.keyboard("{Enter}");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Supprimer l'équipe" }),
      ),
    );
  });

  it("passes the axe checks, deletion question open", async () => {
    const { ui, container } = setup();
    await ui.click(
      await screen.findByRole("button", { name: "Supprimer l'équipe" }),
    );
    await expectNoAxeViolations(container);
  });
});
