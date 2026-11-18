import type { Metadata } from "next";
import { NewPlayer } from "./new-player";

export const metadata: Metadata = { title: "Créer un joueur · Administration" };

export default function NewPlayerPage() {
  return <NewPlayer />;
}
