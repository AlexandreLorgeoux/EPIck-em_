import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { SkipLink } from "@/components/skip-link";
import { routes } from "@/lib/routes";
import { AdminNav, NavLinks } from "./admin-nav";
import { SignOut } from "./sign-out";

// Frame of every admin page: a skip link, the navigation and the account.
// Pages render inside <main>, so they start with their own h1.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <SkipLink />
      <header className="border-b border-line bg-surface-raised">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <Link
            href={routes.admin.home}
            className="inline-flex flex-wrap items-center gap-3 text-ink no-underline"
          >
            <Logo />
            <span className="label text-ink-soft">Administration</span>
          </Link>
          <SignOut />
        </div>
        {/* The current page is only known in the browser on pages with an
            id in their URL: until then, the links show without it */}
        <Suspense fallback={<NavLinks current={null} />}>
          <AdminNav />
        </Suspense>
      </header>
      <main id="contenu" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </>
  );
}
