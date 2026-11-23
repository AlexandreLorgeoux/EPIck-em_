/**
 * @jest-environment jsdom
 */
import { mockRouter } from "@/test/mock-navigation";
import { beforeEach, describe, expect, it } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "@/test/axe";
import { fakeApi } from "@/test/fake-api";
import { NewPlayer } from "./new-player";

describe("NewPlayer", () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
  });

  it("creates the player and returns to the list", async () => {
    const fake = fakeApi({ "POST /players": [201, { id: "p1" }] });
    const ui = userEvent.setup();
    render(<NewPlayer />);
    await ui.type(screen.getByLabelText("Pseudo"), "Brindille{Enter}");
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith("/admin/players"),
    );
    expect(fake.calls[0].body).toEqual({ handle: "Brindille" });
  });

  it("says how to fix a pseudo that is too short, and focuses it", async () => {
    fakeApi({
      "POST /players": [
        400,
        {
          message: ["handle must be between 2 and 32 characters"],
          errors: { handle: ["handle must be between 2 and 32 characters"] },
        },
      ],
    });
    const ui = userEvent.setup();
    const { container } = render(<NewPlayer />);
    await ui.type(screen.getByLabelText("Pseudo"), "B{Enter}");

    const handle = screen.getByLabelText("Pseudo");
    await waitFor(() => expect(document.activeElement).toBe(handle));
    expect(screen.getByText(/«Pseudo» doit faire/).textContent).toBe(
      "«Pseudo» doit faire entre 2 et 32 caractères. Tu en as saisi 1 : ajoute au moins 1 caractère.",
    );
    await expectNoAxeViolations(container);
  });
});
