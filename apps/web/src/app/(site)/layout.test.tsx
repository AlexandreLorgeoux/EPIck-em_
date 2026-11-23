/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from "@jest/globals";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "@/test/axe";
import SiteLayout from "./layout";

function renderSite() {
  return render(
    <SiteLayout params={Promise.resolve({})}>
      <h1>Tournois</h1>
    </SiteLayout>,
  );
}

describe("SiteLayout", () => {
  it("starts with a skip link to the content", async () => {
    renderSite();
    await userEvent.setup().tab();
    const skip = screen.getByRole("link", { name: "Aller au contenu" });
    expect(document.activeElement).toBe(skip);
    expect(skip.getAttribute("href")).toBe("#contenu");
    expect(screen.getByRole("main").id).toBe("contenu");
  });

  it("names the logo link and offers the public pages", () => {
    renderSite();
    expect(
      screen
        .getByRole("link", { name: "Oracup, accueil" })
        .getAttribute("href"),
    ).toBe("/");
    const nav = screen.getByRole("navigation", { name: "Principale" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Tournois", "/tournaments"],
      ["Se connecter", "/login"],
    ]);
  });

  it("passes the axe checks", async () => {
    const { container } = renderSite();
    await expectNoAxeViolations(container);
  });
});
