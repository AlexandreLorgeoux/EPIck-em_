import type { Metadata } from "next";
import { TournamentForm } from "./tournament-form";

export const metadata: Metadata = {
  title: "Créer un tournoi · Administration",
};

export default function NewTournamentPage() {
  return <TournamentForm />;
}
