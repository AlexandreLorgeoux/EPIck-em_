import type { Metadata } from "next";
import { TeamList } from "./team-list";

export const metadata: Metadata = { title: "Équipes · Administration" };

export default function AdminTeamsPage() {
  return <TeamList />;
}
