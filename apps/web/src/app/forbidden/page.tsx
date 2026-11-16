import type { Metadata } from "next";
import Link from "next/link";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Accès refusé · EPIck'em" };

// Shown in place of a page the user's role cannot open (src/proxy.ts), at
// the same URL
export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-bold">Accès refusé</h1>
      <p>
        Ton compte n&apos;a pas accès à cette page. Si tu penses que c&apos;est
        une erreur, demande à un administrateur de vérifier ton rôle.
      </p>
      <ul className="flex flex-col gap-3">
        <li>
          <Link href={routes.home} className="underline underline-offset-4">
            Retour à l&apos;accueil
          </Link>
        </li>
        <li>
          <Link href={routes.login} className="underline underline-offset-4">
            Se connecter avec un autre compte
          </Link>
        </li>
      </ul>
    </main>
  );
}
