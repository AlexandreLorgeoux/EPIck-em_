import type { Metadata } from "next";

export const metadata: Metadata = { title: "Administration · EPIck'em" };

// Entry of the admin area, reserved to admins by src/proxy.ts. The screens
// themselves come with tickets #25 to #27.
export default function AdminHomePage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-bold">Administration</h1>
      <p>
        Les écrans de gestion des équipes, des joueurs et des tournois arrivent
        bientôt.
      </p>
    </main>
  );
}
