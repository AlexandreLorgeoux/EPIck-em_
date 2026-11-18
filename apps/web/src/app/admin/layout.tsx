import Link from "next/link";
import { Suspense } from "react";
import { routes } from "@/lib/routes";
import { AdminNav, NavLinks } from "./admin-nav";
import { SignOut } from "./sign-out";

// Frame of every admin page: a skip link, the navigation and the account.
// Pages render inside <main>, so they start with their own h1.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:border-2 focus:bg-white focus:px-4 focus:py-2 focus:font-bold"
      >
        Aller au contenu
      </a>
      <header className="border-b-2">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <Link href={routes.admin.home} className="text-xl font-bold">
            EPIck&apos;em · Administration
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
