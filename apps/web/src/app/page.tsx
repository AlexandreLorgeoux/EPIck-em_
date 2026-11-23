import Link from "next/link";
import { routes } from "@/lib/routes";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-bold">EPIck&apos;em</h1>
      <p>Suis les tournois en direct, sans compte.</p>
      <Link href={routes.tournaments} className="underline underline-offset-4">
        Voir les tournois
      </Link>
    </main>
  );
}
