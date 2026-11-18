import type { Metadata } from "next";
import { NewTeam } from "./new-team";

export const metadata: Metadata = {
  title: "Créer une équipe · Administration",
};

export default function NewTeamPage() {
  return <NewTeam />;
}
