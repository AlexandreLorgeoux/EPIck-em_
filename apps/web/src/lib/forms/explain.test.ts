import { describe, expect, it } from "@jest/globals";
import { explainFieldError, explainMessage } from "./explain";

const labels = { name: "Nom", startsAt: "Début", endsAt: "Fin prévue" };

describe("explainFieldError", () => {
  it("says how many characters to add", () => {
    expect(
      explainFieldError("name", "name must be between 2 and 64 characters", {
        labels,
        values: { name: "A" },
      }),
    ).toBe(
      "«Nom» doit faire entre 2 et 64 caractères. Tu en as saisi 1 : ajoute au moins 1 caractère.",
    );
  });

  it("says how many characters to remove", () => {
    expect(
      explainFieldError("name", "name must be between 2 and 4 characters", {
        labels,
        values: { name: "Alphabet" },
      }),
    ).toBe(
      "«Nom» doit faire entre 2 et 4 caractères. Tu en as saisi 8 : retire au moins 4 caractères.",
    );
  });

  it("counts characters as the API does, without surrounding spaces", () => {
    expect(
      explainFieldError("name", "name must be between 2 and 64 characters", {
        labels,
        values: { name: "  A  " },
      }),
    ).toContain("Tu en as saisi 1");
  });

  it("names both fields of a date order error", () => {
    expect(
      explainFieldError("endsAt", "endsAt must be after startsAt", { labels }),
    ).toBe(
      "«Fin prévue» doit être après «Début» : choisis une date plus tardive.",
    );
  });

  it("explains a missing field and an invalid date", () => {
    expect(explainFieldError("name", "name must be a string", { labels })).toBe(
      "«Nom» est obligatoire : remplis ce champ.",
    );
    expect(
      explainFieldError(
        "startsAt",
        "startsAt must be a date such as 2026-12-05T14:00:00Z",
        { labels },
      ),
    ).toBe("«Début» n'est pas une date valide : choisis un jour et une heure.");
  });

  it("keeps a message it has no rule for", () => {
    expect(explainFieldError("name", "something new", { labels })).toBe(
      "something new",
    );
  });
});

describe("explainMessage", () => {
  it.each([
    [
      "This team is registered in 2 tournament(s): withdraw the registrations before deleting the team",
      "Cette équipe est inscrite à 2 tournois : retire-la de ces tournois avant de supprimer.",
    ],
    [
      "This player is registered in 1 tournament(s): withdraw the registrations before deleting the player",
      "Ce joueur est inscrit à 1 tournoi : retire-le de ce tournoi avant de supprimer.",
    ],
    [
      "Kestrel already belongs to Marmottes: remove them from that team first",
      "Kestrel fait déjà partie de Marmottes : retire-le de cette équipe d'abord.",
    ],
    [
      "This tournament is running: only a draft tournament can be started",
      "Ce tournoi est en cours : seul un brouillon peut encore changer.",
    ],
  ])("translates %p", (message, french) => {
    expect(explainMessage(message)).toBe(french);
  });

  it("keeps a message it has no rule for", () => {
    expect(explainMessage("Internal server error")).toBe(
      "Internal server error",
    );
  });
});
