import type { Metadata } from "next";
import { Suspense } from "react";
import { TeamEditor } from "./team-editor";

export const metadata: Metadata = { title: "Équipe · Administration" };

// The id is only known at request time: read it under Suspense so the rest
// of the page can still be prerendered (Cache Components)
async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeamEditor id={id} />;
}

export default function AdminTeamPage({
  params,
}: PageProps<"/admin/teams/[id]">) {
  return (
    <Suspense fallback={<p className="px-4 py-12 text-center">Chargement…</p>}>
      <Editor params={params} />
    </Suspense>
  );
}
