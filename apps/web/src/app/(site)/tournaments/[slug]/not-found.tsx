import Link from "next/link";
import { routes } from "@/lib/routes";

export default function TournamentNotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-12">
      <h1 className="display">Tournoi introuvable</h1>
      <p>
        Ce tournoi n&apos;existe pas ou n&apos;est pas encore public. Vérifie
        l&apos;adresse, ou retrouve-le dans la liste.
      </p>
      <Link href={routes.tournaments} className="underline underline-offset-4">
        Voir les tournois
      </Link>
    </div>
  );
}
