import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { primaryButtonClass } from "@/components/styles";
import { routes } from "@/lib/routes";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-4 py-12">
      <LogoMark size={72} />
      <h1 className="display-xl">Oracup</h1>
      <p className="body-lg text-ink-soft">
        Suis les tournois en direct, sans compte : l&apos;arbre, les scores et
        les vainqueurs, mis à jour à chaque résultat.
      </p>
      <Link href={routes.tournaments} className={primaryButtonClass}>
        Voir les tournois
      </Link>
    </div>
  );
}
