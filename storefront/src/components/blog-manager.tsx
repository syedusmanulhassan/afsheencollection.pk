"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { hasSupabaseConfig, slugify, type BlogPost } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";

type BlogForm = {
  id?: string;
  title: string;
  excerpt: string;
  content: string;
  author_name: string;
  image_url: string;
  published: boolean;
};

const blankPost: BlogForm = {
  title: "", excerpt: "", content: "", author_name: "Afsheen Collection",
  image_url: "", published: false,
};

export function BlogManager() {
  const configured = hasSupabaseConfig();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [form, setForm] = useState<BlogForm | null>(null);
  const [loading, setLoading] = useState(configured);
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!configured) return;
    void loadPosts();
  }, [configured]);

  async function loadPosts() {
    const { data, error } = await getSupabase()
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setFailure(`Blog posts could not be loaded: ${error.message}`);
    else setPosts((data ?? []) as BlogPost[]);
    setLoading(false);
  }

  async function savePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setFailure("");
    setNotice("");
    const title = form.title.trim();
    const slug = slugify(title);
    if (!slug || form.content.trim().length < 10) {
      setFailure("Add a title and at least 10 characters of story content.");
      return;
    }
    const values = {
      title,
      slug,
      excerpt: form.excerpt.trim(),
      content: form.content.trim(),
      author_name: form.author_name.trim() || "Afsheen Collection",
      image_url: form.image_url.trim() || null,
      published: form.published,
      published_at: form.published ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    const supabase = getSupabase();
    const result = form.id
      ? await supabase.from("blog_posts").update(values).eq("id", form.id)
      : await supabase.from("blog_posts").insert(values);
    if (result.error) setFailure(`Blog post could not be saved: ${result.error.message}`);
    else {
      setNotice(form.published ? "Blog post saved and published." : "Blog draft saved.");
      setForm(null);
      setLoading(true);
      await loadPosts();
    }
  }

  async function deletePost(post: BlogPost) {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    const { error } = await getSupabase().from("blog_posts").delete().eq("id", post.id);
    if (error) setFailure(`Blog post could not be deleted: ${error.message}`);
    else {
      setNotice("Blog post deleted.");
      setPosts(posts.filter((item) => item.id !== post.id));
    }
  }

  if (!configured) return <div className="setup-banner">Connect Supabase to manage journal posts.</div>;

  return (
    <>
      {notice && <div className="notice">{notice}</div>}
      {failure && <div className="notice error">{failure}</div>}
      <div className="admin-section-heading">
        <h2>Journal posts ({posts.length})</h2>
        <div className="admin-actions">
          <Link className="plain-button" href="/blog">View journal</Link>
          <button className="button button-primary button-small" type="button" onClick={() => setForm({ ...blankPost })}>Write a post</button>
        </div>
      </div>
      {form && (
        <div className="editor-panel">
          <form className="editor-form" onSubmit={savePost}>
            <label className="wide">Title<input required maxLength={180} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
            <label>Author<input maxLength={100} value={form.author_name} onChange={(event) => setForm({ ...form, author_name: event.target.value })} /></label>
            <label className="checkbox-field"><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} /> Published on the journal</label>
            <label className="wide">Short excerpt<textarea maxLength={500} value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} /></label>
            <label className="wide">Story text<textarea required minLength={10} maxLength={20000} rows={12} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label>
            <label className="wide">Featured image URL<input type="url" maxLength={1000} value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} /></label>
            <div className="wide admin-actions">
              <button className="button button-primary button-small" type="submit">Save post</button>
              <button type="button" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      {loading ? <p>Loading journal posts…</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Title</th><th>Author</th><th>Status</th><th /></tr></thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>{post.title}</td>
                  <td>{post.author_name}</td>
                  <td><span className="status-pill">{post.published ? "Published" : "Draft"}</span></td>
                  <td><div className="admin-actions">
                    {post.published && <Link className="plain-button" href={`/blog/${post.slug}`}>View</Link>}
                    <button type="button" onClick={() => setForm({ id: post.id, title: post.title, excerpt: post.excerpt, content: post.content, author_name: post.author_name, image_url: post.image_url ?? "", published: post.published })}>Edit</button>
                    <button className="danger-button" type="button" onClick={() => void deletePost(post)}>Delete</button>
                  </div></td>
                </tr>
              ))}
              {!posts.length && <tr><td colSpan={4}>No journal posts yet. Start with a draft or publish a story.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
