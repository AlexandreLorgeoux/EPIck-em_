import type { Metadata } from "next";
import { TournamentList } from "./tournament-list";

export const metadata: Metadata = { title: "Tournois · Administration" };

export default function AdminTournamentsPage() {
  return <TournamentList />;
}
