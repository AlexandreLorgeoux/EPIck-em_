/**
 * @jest-environment jsdom
 */
import { mockRouter } from "@/test/mock-navigation";
import { beforeEach, describe, expect, it } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeApi } from "@/test/fake-api";
import { NewTeam } from "./new-team";

describe("NewTeam", () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
  });

  it("creates the team from the keyboard, then opens it to add players", async () => {
    const fake = fakeApi({ "POST /teams": [201, { id: "t1" }] });
    const ui = userEvent.setup();
    render(<NewTeam />);

    // Back link, then the name field
    await ui.tab();
    await ui.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Nom"));
    await ui.keyboard("Marmottes");
    await ui.tab();
    await ui.keyboard("MRM{Enter}");

    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith("/admin/teams/t1"),
    );
    expect(fake.calls[0].body).toEqual({ name: "Marmottes", tag: "MRM" });
  });

  it("leaves the tag out when empty", async () => {
    const fake = fakeApi({ "POST /teams": [201, { id: "t1" }] });
    const ui = userEvent.setup();
    render(<NewTeam />);
    await ui.type(screen.getByLabelText("Nom"), "Quokkas");
    await ui.click(screen.getByRole("button", { name: "Créer l'équipe" }));
    await waitFor(() => expect(fake.calls).toHaveLength(1));
    expect(fake.calls[0].body).toEqual({ name: "Quokkas" });
  });

  it("explains each wrong field in French, says how to fix it, and focuses it", async () => {
    fakeApi({
      "POST /teams": [
        400,
        {
          message: ["tag must be between 1 and 8 characters"],
          errors: { tag: ["tag must be between 1 and 8 characters"] },
        },
      ],
    });
    const ui = userEvent.setup();
    render(<NewTeam />);
    await ui.type(screen.getByLabelText("Nom"), "Marmottes");
    await ui.type(screen.getByLabelText(/^Tag/), "MARMOTTES");
    await ui.click(screen.getByRole("button", { name: "Créer l'équipe" }));

    const tag = screen.getByLabelText(/^Tag/);
    await waitFor(() => expect(document.activeElement).toBe(tag));
    expect(tag.getAttribute("aria-invalid")).toBe("true");
    const errorId = tag.getAttribute("aria-describedby")!.split(" ").at(-1)!;
    expect(document.getElementById(errorId)?.textContent).toBe(
      "⚠ «Tag» doit faire entre 1 et 8 caractères. Tu en as saisi 9 : retire au moins 1 caractère.",
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
