/**
 * @jest-environment jsdom
 */
import { mockRouter } from "@/test/mock-navigation";
import { beforeEach, describe, expect, it } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/api/client";
import {
  AuthProvider,
  SESSION_EXPIRED_MESSAGE,
} from "@/lib/auth/auth-provider";
import { fakeApi, signedOut, user } from "@/test/fake-api";
import { LoginForm } from "./login-form";

const signedOutApi = (login: [number, unknown]) =>
  fakeApi({
    "GET /auth/me": [401, signedOut],
    "POST /auth/refresh": [401, signedOut],
    "POST /auth/login": login,
  });

function renderLogin() {
  render(
    <AuthProvider>
      <LoginForm />
    </AuthProvider>,
  );
  return userEvent.setup();
}

async function signIn(
  ui: ReturnType<typeof userEvent.setup>,
  email: string,
  password: string,
) {
  await ui.type(screen.getByLabelText("Adresse e-mail"), email);
  await ui.type(screen.getByLabelText("Mot de passe"), password);
  await ui.click(screen.getByRole("button", { name: "Se connecter" }));
}

describe("LoginForm", () => {
  beforeEach(() => {
    mockRouter.replace.mockClear();
    window.history.replaceState({}, "", "/login");
  });

  it("signs in with what was typed and returns to the page in ?next=", async () => {
    window.history.replaceState({}, "", "/login?next=/admin/teams");
    const fake = signedOutApi([200, user]);
    const ui = renderLogin();

    await signIn(ui, "zywoo@example.test", "correct horse battery");

    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith("/admin/teams"),
    );
    expect(
      fake.calls.find((c) => c.route === "POST /auth/login")?.body,
    ).toEqual({
      email: "zywoo@example.test",
      password: "correct horse battery",
    });
  });

  it("says what is wrong when the credentials are refused", async () => {
    signedOutApi([401, { message: "Invalid email or password" }]);
    const ui = renderLogin();

    await signIn(ui, "zywoo@example.test", "wrong password");

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "E-mail ou mot de passe incorrect. Vérifie-les et réessaie.",
    );
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("shows each validation error next to its field", async () => {
    signedOutApi([
      400,
      {
        message: ["email must be a valid email address"],
        errors: { email: ["email must be a valid email address"] },
      },
    ]);
    const ui = renderLogin();

    await signIn(ui, "not-an-email", "whatever");

    const email = screen.getByLabelText("Adresse e-mail");
    await waitFor(() =>
      expect(email.getAttribute("aria-invalid")).toBe("true"),
    );
    const describedBy = email.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)?.textContent).toBe(
      "email must be a valid email address",
    );
    expect(
      screen.getByLabelText("Mot de passe").hasAttribute("aria-invalid"),
    ).toBe(false);
  });

  it("moves focus to the heading and explains when the session expired", async () => {
    const fake = fakeApi({ "GET /auth/me": [200, user] });
    renderLogin();
    await waitFor(() => expect(fake.count("GET /auth/me")).toBe(1));
    await act(async () => {}); // let the signed-in user settle
    fake.set("GET /teams", [401, signedOut]);
    fake.set("POST /auth/refresh", [401, signedOut]);

    await act(async () => {
      await api.get("/teams").catch(() => {});
    });

    const heading = screen.getByRole("heading", { name: "Connexion" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.getAllByText(SESSION_EXPIRED_MESSAGE).length).toBeGreaterThan(
      0,
    );
  });
});
