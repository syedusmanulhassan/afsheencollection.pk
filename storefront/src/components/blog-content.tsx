"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { BlogPost } from "@/lib/store";
import { hasSupabaseConfig } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";

export function BlogIndex() {
  const configured = hasSupabaseConfig();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!configured) return;
    async function loadPosts() {
      try {
        const { data, error: queryError } = await getSupabase()
          .from("blog_posts")
          .select("id, title, slug, excerpt, author_name, image_url, published_at, created_at")
          .eq("published", true)
          .order("published_at", { ascending: false });
        if (queryError) setError(queryError.message);
        else setPosts((data ?? []) as BlogPost[]);
        setLoading(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load the journal.");
        setLoading(false);
      }
    }
    void loadPosts();
  }, [configured]);

  return (
    <main className="content-page journal-page">
      <p className="breadcrumb"><Link href="/">Home</Link> / The Journal</p>
      <header className="journal-heading">
        <p className="eyebrow">Notes from Afsheen</p>
        <h1 className="page-title">The Journal</h1>
        <p>Fresh inspiration, thoughtful stories, and little things worth sharing.</p>
      </header>
      {!configured && <div className="setup-banner">Connect Supabase to publish journal stories.</div>}
      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <p className="empty-state">Loading stories…</p>
      ) : posts.length ? (
        <div className="journal-grid">
          {posts.map((post) => (
            <article className="journal-card" key={post.id}>
              <Link
                className={`journal-image${post.image_url ? " has-image" : ""}`}
                href={`/blog/${post.slug}`}
                style={post.image_url ? { backgroundImage: `url("${post.image_url}")` } : undefined}
                aria-label={post.title}
              />
              <p className="eyebrow">{post.author_name}</p>
              <h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
              <p>{post.excerpt}</p>
              <Link className="text-link" href={`/blog/${post.slug}`}>Read story <span aria-hidden="true">↗</span></Link>
            </article>
          ))}
        </div>
      ) : !error && (
        <div className="empty-state"><h3>Our journal is just getting started.</h3><p>Check back soon for new stories.</p></div>
      )}
    </main>
  );
}

export function BlogArticle({ slug }: { slug: string }) {
  const configured = hasSupabaseConfig();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!configured) return;
    async function loadPost() {
      try {
        const { data, error: queryError } = await getSupabase()
          .from("blog_posts")
          .select("id, title, slug, excerpt, content, author_name, image_url, published_at, created_at")
          .eq("slug", slug)
          .eq("published", true)
          .maybeSingle();
        if (queryError) setError(queryError.message);
        else setPost((data as BlogPost | null) ?? null);
        setLoading(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load this story.");
        setLoading(false);
      }
    }
    void loadPost();
  }, [configured, slug]);

  if (loading) return <main className="content-page">Loading story…</main>;
  if (!configured) return <main className="content-page"><div className="setup-banner">Connect Supabase to load stories.</div></main>;
  if (error) return <main className="content-page"><div className="error-banner">{error}</div></main>;
  if (!post) return <main className="content-page not-found"><h1>Story not found</h1><Link className="text-link" href="/blog">Back to the journal</Link></main>;

  return (
    <main className="content-page article-page">
      <p className="breadcrumb"><Link href="/">Home</Link> / <Link href="/blog">The Journal</Link> / {post.title}</p>
      <article>
        <header className="article-heading">
          <p className="eyebrow">{post.author_name}{post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString()}` : ""}</p>
          <h1 className="page-title">{post.title}</h1>
          {post.excerpt && <p>{post.excerpt}</p>}
        </header>
        {post.image_url && <div className="article-image" role="img" aria-label={post.title} style={{ backgroundImage: `url("${post.image_url}")` }} />}
        <div className="article-content">{post.content}</div>
      </article>
      <Link className="text-link" href="/blog">← Back to the journal</Link>
    </main>
  );
}
