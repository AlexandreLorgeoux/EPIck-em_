/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Player } from "@/lib/api/models";
import { fakeApi } from "@/test/fake-api";
import { PlayerList } from "./player-list";

const players: Player[] = [
  {
    id: "p1",
    handle: "Kestrel",
    userId: null,
    team: {
      id: "t1",
      name: "Marmottes",
      tag: "MRM",
      isSubstitute: false,
      role: null,
    },
  },
  { id: "p2", handle: "Brindille", userId: null, team: null },
];

describe("PlayerList", () => {
  it("lists players with their team, or says they have none", async () => {
    fakeApi({ "GET /players": [200, players] });
    render(<PlayerList />);
    const rows = (await screen.findAllByRole("row")).slice(1);
    expect(
      rows.map((row) => [...row.children].map((cell) => cell.textContent)),
    ).toEqual([
      ["Kestrel", "Marmottes"],
      ["Brindille", "Sans équipe"],
    ]);
    expect(
      screen.getByRole("link", { name: "Marmottes" }).getAttribute("href"),
    ).toBe("/admin/teams/t1");
  });

  it("finds players by pseudo or team", async () => {
    fakeApi({ "GET /players": [200, players] });
    const ui = userEvent.setup();
    render(<PlayerList />);
    await ui.type(
      await screen.findByLabelText("Rechercher un joueur ou une équipe"),
      "marmo",
    );
    expect(
      screen.getAllByRole("rowheader").map((cell) => cell.textContent),
    ).toEqual(["Kestrel"]);
    expect(screen.getByRole("status").textContent).toBe("1 joueur sur 2");
  });
});
