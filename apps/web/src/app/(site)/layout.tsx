import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SkipLink } from "@/components/skip-link";
import { routes } from "@/lib/routes";

// Frame of the public pages: logo, navigation and the content
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SkipLink />
      <header className="border-b border-line bg-surface-raised">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <Link
            href={routes.home}
            aria-label="Oracup, accueil"
            className="no-underline"
          >
            <Logo />
          </Link>
          <nav aria-label="Principale" className="min-w-0">
            <ul className="flex flex-wrap gap-x-6">
              <li>
                <Link
                  href={routes.tournaments}
                  className="label inline-flex min-h-11 items-center text-ink"
                >
                  Tournois
                </Link>
              </li>
              <li>
                <Link
                  href={routes.login}
                  className="label inline-flex min-h-11 items-center text-ink"
                >
                  Se connecter
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="contenu" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </>
  );
}
