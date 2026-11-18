/**
 * @jest-environment jsdom
 */
import { mockPathname } from "@/test/mock-navigation";
import { describe, expect, it } from "@jest/globals";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { expectNoAxeViolations } from "@/test/axe";
import { fakeApi, user } from "@/test/fake-api";
import AdminLayout from "./layout";

function renderAt(path: string) {
  mockPathname.current = path;
  fakeApi({ "GET /auth/me": [200, user] });
  return render(
    <AuthProvider>
      <AdminLayout params={Promise.resolve({})}>
        <h1>Équipes</h1>
      </AdminLayout>
    </AuthProvider>,
  );
}

describe("AdminLayout", () => {
  it("marks the current section, in words for screen readers", async () => {
    renderAt("/admin/teams/42");
    const nav = screen.getByRole("navigation", { name: "Administration" });
    const current = within(nav)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual(["Équipes"]);
  });

  it("marks Accueil only on the admin home itself", () => {
    renderAt("/admin");
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual(["Accueil"]);
  });

  it("offers a skip link first, pointing at the content", async () => {
    renderAt("/admin/teams");
    const ui = userEvent.setup();
    await ui.tab();
    const skip = screen.getByRole("link", { name: "Aller au contenu" });
    expect(document.activeElement).toBe(skip);
    expect(skip.getAttribute("href")).toBe("#contenu");
    const main = screen.getByRole("main");
    expect(main.id).toBe("contenu");
    // Focusable by script, so the skip link can move focus there
    expect(main.getAttribute("tabindex")).toBe("-1");
  });

  it("names the signed-in admin and lets them sign out", async () => {
    renderAt("/admin");
    expect(await screen.findByText("Connecté en tant que Zywoo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeTruthy();
  });

  it("passes the axe checks", async () => {
    const { container } = renderAt("/admin/players");
    await screen.findByText("Connecté en tant que Zywoo");
    await expectNoAxeViolations(container);
  });
});
