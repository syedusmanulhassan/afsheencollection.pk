"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { formatPrice, hasSupabaseConfig, type StoreOrder } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";

type AccountUser = {
  id: string;
  email: string | undefined;
};

export function AccountPage() {
  const configured = hasSupabaseConfig();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [loading, setLoading] = useState(configured);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    const supabase = getSupabase();

    async function loadAccount(userId?: string) {
      const { data: authData, error: authError } = userId
        ? { data: { user: { id: userId, email: undefined } }, error: null }
        : await supabase.auth.getUser();
      if (!active) return;
      if (authError) {
        setFailure(authError.message);
        setLoading(false);
        return;
      }
      if (!authData.user) {
        setUser(null);
        setOrders([]);
        setLoading(false);
        return;
      }
      const accountUser = authData.user as AccountUser;
      setUser(accountUser);
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, total, status, payment_method, payment_status, created_at")
        .eq("customer_id", accountUser.id)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) setFailure(`Your order history could not load: ${error.message}`);
      else setOrders((data ?? []) as StoreOrder[]);
      setLoading(false);
    }

    void loadAccount();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => void loadAccount(session?.user.id));
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [configured]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure("");
    setNotice("");
    setSubmitting(true);
    try {
      const supabase = getSupabase();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (error) throw error;
        if (!data.user) throw new Error("Account registration did not return a user.");
        if (!data.session) {
          setNotice("Your account was created. Check your email to confirm your address, then sign in.");
        } else {
          setUser({ id: data.user.id, email: data.user.email });
          setNotice("Your account is ready.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setUser({ id: data.user.id, email: data.user.email });
        setNotice("You’re signed in.");
      }
      setPassword("");
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "We couldn’t complete your request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut() {
    setFailure("");
    const { error } = await getSupabase().auth.signOut();
    if (error) setFailure(`Sign out failed: ${error.message}`);
    else {
      setUser(null);
      setOrders([]);
      setNotice("You’re signed out.");
    }
  }

  if (!configured) {
    return <main className="admin-login"><h1>Customer account</h1><div className="setup-banner">Connect Supabase to enable customer accounts.</div></main>;
  }
  if (loading) return <main className="content-page">Loading your account…</main>;

  return (
    <main className="content-page">
      <p className="breadcrumb"><Link href="/">Home</Link> / My account</p>
      {notice && <div className="notice">{notice}</div>}
      {failure && <div className="notice error">{failure}</div>}
      {user ? (
        <>
          <div className="section-heading">
            <div><p className="eyebrow">Your Afsheen account</p><h1 className="page-title">Welcome back.</h1><p className="muted">{user.email}</p></div>
            <button className="plain-button" type="button" onClick={() => void signOut()}>Sign out</button>
          </div>
          <section className="section-block account-orders">
            <h2 className="page-title">Your orders</h2>
            {orders.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
                  <tbody>{orders.map((order) => (
                    <tr key={order.id}>
                      <td>#{order.order_number}</td>
                      <td>{new Date(order.created_at).toLocaleDateString()}</td>
                      <td>{formatPrice(order.total)}</td>
                      <td>{order.payment_status === "paid" ? "Paid" : order.payment_method === "cod" ? "Cash on delivery" : "Bank transfer"}</td>
                      <td><span className="status-pill">{order.status}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><h3>Your orders will appear here.</h3><Link className="text-link" href="/">Explore the store</Link></div>
            )}
          </section>
        </>
      ) : (
        <section className="account-shell">
          <div className="account-intro">
            <p className="eyebrow">Afsheen Collection</p>
            <h1 className="page-title">{mode === "signup" ? "Make yourself at home." : "Welcome back."}</h1>
            <p>Create an account to view your orders any time, or check out as a guest whenever you like.</p>
            <p><Link className="text-link" href="/cart">Your bag is always ready <span aria-hidden="true">↗</span></Link></p>
          </div>
          <div className="account-form-panel">
            <div className="account-switch">
              <button className={mode === "signup" ? "selected" : ""} type="button" onClick={() => { setMode("signup"); setFailure(""); }}>Create account</button>
              <button className={mode === "signin" ? "selected" : ""} type="button" onClick={() => { setMode("signin"); setFailure(""); }}>Sign in</button>
            </div>
            <form className="checkout-form" onSubmit={submit}>
              {mode === "signup" && <label>Your name<input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>}
              <label>Email address<input required type="email" maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label>Password<input required type="password" minLength={8} maxLength={72} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} /><span className="muted">Use at least 8 characters.</span></label>
              <button className="button button-primary" type="submit" disabled={submitting}>{submitting ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</button>
            </form>
            <p className="muted guest-note">Prefer not to sign up? <Link className="text-link" href="/cart">Guest checkout is available.</Link></p>
          </div>
        </section>
      )}
    </main>
  );
}
