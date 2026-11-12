import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion · EPIck'em" };

export default function LoginPage() {
  return <LoginForm />;
}
