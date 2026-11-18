import { expect } from "@jest/globals";
import axe from "axe-core";

// Runs the axe accessibility rules on a rendered component and fails with
// the list of problems found. Two rules are left out: color contrast needs
// a real browser to compute colors, and "region" expects the page layout
// (landmarks), which component tests do not render.
export async function expectNoAxeViolations(container: Element) {
  const results = await axe.run(container, {
    rules: {
      "color-contrast": { enabled: false },
      region: { enabled: false },
    },
  });
  const problems = results.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target).join(", ")})`,
  );
  expect(problems).toEqual([]);
}
