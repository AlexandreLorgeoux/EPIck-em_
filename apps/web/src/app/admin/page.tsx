import type { Metadata } from "next";
import Link from "next/link";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Administration" };

const sections = [
  {
    href: routes.admin.tournaments,
    title: "Tournois",
    text: "Créer un tournoi, inscrire les équipes et générer l'arbre.",
  },
  {
    href: routes.admin.teams,
    title: "Équipes",
    text: "Créer les équipes, choisir leurs joueurs et leur capitaine.",
  },
  {
    href: routes.admin.players,
    title: "Joueurs",
    text: "Créer les joueurs avant de les ajouter à une équipe.",
  },
];

// Entry of the admin area, reserved to admins by src/proxy.ts
export default function AdminHomePage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-12">
      <h1 className="display">Administration</h1>
      <ul className="grid gap-4 sm:grid-cols-3">
        {sections.map((section) => (
          <li key={section.href} className="oc-card">
            <h2 className="heading">
              <Link
                href={section.href}
                className="underline underline-offset-4"
              >
                {section.title}
              </Link>
            </h2>
            <p>{section.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
