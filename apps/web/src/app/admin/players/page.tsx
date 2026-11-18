import type { Metadata } from "next";
import { PlayerList } from "./player-list";

export const metadata: Metadata = { title: "Joueurs · Administration" };

export default function AdminPlayersPage() {
  return <PlayerList />;
}
