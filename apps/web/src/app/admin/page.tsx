import type { Metadata } from "next";
import Link from "next/link";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Administration · EPIck'em" };

// Entry of the admin area, reserved to admins by src/proxy.ts. Its layout
// and navigation come with ticket #25.
export default function AdminHomePage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-bold">Administration</h1>
      <ul className="flex flex-col gap-3">
        <li>
          <Link
            href={routes.admin.tournaments}
            className="underline underline-offset-4"
          >
            Tournois
          </Link>
        </li>
      </ul>
      <p>Les écrans de gestion des équipes et des joueurs arrivent bientôt.</p>
    </main>
  );
}
