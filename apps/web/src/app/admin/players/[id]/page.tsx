import type { Metadata } from "next";
import { Suspense } from "react";
import { PlayerEditor } from "./player-editor";

export const metadata: Metadata = { title: "Joueur · Administration" };

// The id is only known at request time: read it under Suspense so the rest
// of the page can still be prerendered (Cache Components)
async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlayerEditor id={id} />;
}

export default function AdminPlayerPage({
  params,
}: PageProps<"/admin/players/[id]">) {
  return (
    <Suspense fallback={<p className="px-4 py-12 text-center">Chargement…</p>}>
      <Editor params={params} />
    </Suspense>
  );
}
