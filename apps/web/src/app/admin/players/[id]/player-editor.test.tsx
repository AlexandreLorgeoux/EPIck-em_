/**
 * @jest-environment jsdom
 */
import { mockRouter } from "@/test/mock-navigation";
import { beforeEach, describe, expect, it } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Player } from "@/lib/api/models";
import { expectNoAxeViolations } from "@/test/axe";
import { fakeApi } from "@/test/fake-api";
import { PlayerEditor } from "./player-editor";
import { toastMessages, withToasts } from "@/test/toasts";

const kestrel: Player = {
  id: "p1",
  handle: "Kestrel",
  userId: null,
  team: {
    id: "t1",
    name: "Marmottes",
    tag: null,
    isSubstitute: true,
    role: null,
  },
};

function setup() {
  const fake = fakeApi({ "GET /players/p1": [200, kestrel] });
  const view = render(withToasts(<PlayerEditor id="p1" />));
  return { fake, ui: userEvent.setup(), ...view };
}

describe("PlayerEditor", () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
  });

  it("shows the team and where to change it", async () => {
    setup();
    const link = await screen.findByRole("link", { name: "Marmottes" });
    expect(link.getAttribute("href")).toBe("/admin/teams/t1");
    expect(link.parentElement?.textContent).toContain("(remplaçant)");
  });

  it("renames the player", async () => {
    const { fake, ui } = setup();
    const handle = await screen.findByLabelText("Pseudo");
    await ui.clear(handle);
    await ui.type(handle, "Faucon");
    fake.set("PATCH /players/p1", [200, { ...kestrel, handle: "Faucon" }]);
    await ui.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByRole("heading", { level: 1, name: "Faucon" });
    expect(fake.calls.at(-1)?.body).toEqual({ handle: "Faucon" });
  });

  it("deletes the player after a confirmation", async () => {
    const { fake, ui } = setup();
    fake.set("DELETE /players/p1", [204]);
    await ui.click(
      await screen.findByRole("button", { name: "Supprimer le joueur" }),
    );
    expect(fake.count("DELETE /players/p1")).toBe(0);
    await ui.click(
      screen.getByRole("button", { name: "Supprimer définitivement" }),
    );
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith("/admin/players"),
    );
  });

  it("explains in French why a registered player cannot be deleted", async () => {
    const { fake, ui } = setup();
    fake.set("DELETE /players/p1", [
      409,
      {
        message:
          "This player is registered in 2 tournament(s): withdraw the registrations before deleting the player",
      },
    ]);
    await ui.click(
      await screen.findByRole("button", { name: "Supprimer le joueur" }),
    );
    await ui.click(
      screen.getByRole("button", { name: "Supprimer définitivement" }),
    );
    await waitFor(() =>
      expect(toastMessages("error")).toEqual([
        "Ce joueur est inscrit à 2 tournois : retire-le de ces tournois avant de supprimer.",
      ]),
    );
  });

  it("passes the axe checks", async () => {
    const { container } = setup();
    await screen.findByRole("heading", { level: 1, name: "Kestrel" });
    await expectNoAxeViolations(container);
  });
});
