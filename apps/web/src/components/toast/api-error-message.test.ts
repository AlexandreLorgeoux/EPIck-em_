import { describe, expect, it } from "@jest/globals";
import { ApiError } from "@/lib/api/errors";
import { apiErrorMessage } from "./api-error-message";

describe("apiErrorMessage", () => {
  it("says a prediction is locked, and why", () => {
    const locked = (reason: string) =>
      new ApiError(
        409,
        ["Match 1 has started: predictions are locked"],
        {},
        "prediction_locked",
        reason,
      );
    expect(apiErrorMessage(locked("started"))).toBe(
      "Pronostic refusé : le match a commencé, les pronostics sont verrouillés.",
    );
    expect(apiErrorMessage(locked("played"))).toBe(
      "Pronostic refusé : le match est déjà joué.",
    );
  });

  it("words sign-in and permission errors", () => {
    expect(apiErrorMessage(new ApiError(401, ["Sign in"]))).toBe(
      "Ta session a expiré : reconnecte-toi pour continuer.",
    );
    expect(apiErrorMessage(new ApiError(403, ["requires admin"]))).toBe(
      "Tu n'as pas les droits pour faire cette action.",
    );
  });

  it("points to the fields of a form", () => {
    const one = new ApiError(400, ["x"], { name: ["x"] });
    expect(apiErrorMessage(one)).toBe(
      "Un champ est à corriger : regarde le message sous ce champ.",
    );
    const two = new ApiError(400, ["x", "y"], { name: ["x"], tag: ["y"] });
    expect(apiErrorMessage(two)).toBe(
      "2 champs sont à corriger : regarde les messages sous chacun.",
    );
  });

  it("explains the server's message in French when it can", () => {
    expect(
      apiErrorMessage(
        new ApiError(409, [
          "This team is registered in 1 tournament(s): withdraw the registrations before deleting the team",
        ]),
      ),
    ).toBe(
      "Cette équipe est inscrite à 1 tournoi : retire-la de ce tournoi avant de supprimer.",
    );
    expect(apiErrorMessage(ApiError.network())).toBe(
      "Le serveur ne répond pas : vérifie ta connexion et réessaie.",
    );
  });

  it("falls back on a generic message", () => {
    expect(apiErrorMessage(new ApiError(500, ["Internal server error"]))).toBe(
      "Le serveur a rencontré un problème. Réessaie dans un instant.",
    );
    expect(apiErrorMessage(new ApiError(409, []), "Rien n'a changé.")).toBe(
      "Rien n'a changé.",
    );
    expect(apiErrorMessage(new Error("boom"))).toBe(
      "L'action a échoué. Réessaie dans un instant.",
    );
  });
});
