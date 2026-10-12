import { Suspense } from "react";
import { BlogArticle } from "@/components/blog-content";

async function BlogArticleContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BlogArticle slug={slug} />;
}

export default function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<main className="content-page">Loading story…</main>}>
      <BlogArticleContent params={params} />
    </Suspense>
  );
}
