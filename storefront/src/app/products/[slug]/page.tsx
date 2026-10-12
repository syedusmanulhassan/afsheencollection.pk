import { Suspense } from "react";
import { ProductDetail } from "@/components/product-detail";

async function ProductRouteContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProductDetail slug={slug} />;
}

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<main className="content-page">Loading product…</main>}>
      <ProductRouteContent params={params} />
    </Suspense>
  );
}
