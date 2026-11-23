/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react";
import { StatusBadge } from "./tournament-status";

describe("StatusBadge", () => {
  it.each([
    ["draft", "Brouillon"],
    ["running", "En cours"],
    ["finished", "Terminé"],
  ] as const)(
    "says %s in words, its icon hidden from screen readers",
    (status, word) => {
      const { container } = render(<StatusBadge status={status} />);
      const badge = container.firstElementChild!;
      expect(badge.textContent).toBe(word);
      expect(badge.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
        "true",
      );
    },
  );
});
