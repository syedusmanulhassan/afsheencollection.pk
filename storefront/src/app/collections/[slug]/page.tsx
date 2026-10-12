import { Suspense } from "react";
import { CollectionDetail } from "@/components/collection-detail";

async function CollectionRouteContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CollectionDetail slug={slug} />;
}

export default function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<main className="content-page">Loading collection…</main>}>
      <CollectionRouteContent params={params} />
    </Suspense>
  );
}
