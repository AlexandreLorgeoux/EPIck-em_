/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Team } from "@/lib/api/models";
import { expectNoAxeViolations } from "@/test/axe";
import { fakeApi } from "@/test/fake-api";
import { TeamList } from "./team-list";

const member = (id: string, handle: string) => ({
  id,
  handle,
  isSubstitute: false,
  role: null,
  joinedOn: "2026-11-01",
});

const teams: Team[] = [
  {
    id: "t1",
    name: "Marmottes",
    tag: "MRM",
    captainPlayerId: "p1",
    members: [member("p1", "Kestrel"), member("p2", "Brindille")],
  },
  { id: "t2", name: "Quokkas", tag: null, captainPlayerId: null, members: [] },
];

const names = () =>
  screen.queryAllByRole("rowheader").map((cell) => cell.textContent);

describe("TeamList", () => {
  it("lists the teams with their tag, size and captain", async () => {
    fakeApi({ "GET /teams": [200, teams] });
    render(<TeamList />);
    const row = (
      await screen.findByRole("link", { name: "Marmottes" })
    ).closest("tr")!;
    expect([...row.children].map((cell) => cell.textContent)).toEqual([
      "Marmottes",
      "MRM",
      "2",
      "Kestrel",
    ]);
    expect(
      screen.getByRole("link", { name: "Quokkas" }).getAttribute("href"),
    ).toBe("/admin/teams/t2");
  });

  it("filters by name or tag and says how many teams match", async () => {
    fakeApi({ "GET /teams": [200, teams] });
    const ui = userEvent.setup();
    render(<TeamList />);
    await screen.findByText("2 équipes");

    await ui.type(screen.getByLabelText("Rechercher une équipe"), "mrm");
    expect(names()).toEqual(["Marmottes"]);
    expect(screen.getByRole("status").textContent).toBe("1 équipe sur 2");
  });

  it("explains a list that cannot be loaded, in French", async () => {
    fakeApi({
      "GET /teams": [
        0,
        { message: "Cannot reach the server: check your connection" },
      ],
    });
    render(<TeamList />);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Le serveur ne répond pas : vérifie ta connexion et réessaie.",
    );
  });

  it("passes the axe checks", async () => {
    fakeApi({ "GET /teams": [200, teams] });
    const { container } = render(<TeamList />);
    await screen.findByText("2 équipes");
    await expectNoAxeViolations(container);
  });
});
