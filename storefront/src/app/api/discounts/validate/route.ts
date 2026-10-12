import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("code" in body) ||
    typeof body.code !== "string" ||
    !("subtotal" in body) ||
    typeof body.subtotal !== "number" ||
    !Number.isFinite(body.subtotal) ||
    body.subtotal < 0
  ) {
    return NextResponse.json({ error: "Enter a valid discount code." }, { status: 400 });
  }

  const code = body.code.trim().toUpperCase();
  if (!code || code.length > 40) {
    return NextResponse.json({ error: "Enter a valid discount code." }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("discount_codes")
      .select("code, kind, amount, minimum_order, usage_limit, used_count, starts_at, ends_at, active")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      console.error("Discount lookup failed:", error.message);
      return NextResponse.json({ error: "Could not validate this code right now." }, { status: 500 });
    }
    const now = Date.now();
    if (
      !data ||
      !data.active ||
      (data.starts_at && Date.parse(data.starts_at) > now) ||
      (data.ends_at && Date.parse(data.ends_at) <= now) ||
      (data.usage_limit !== null && data.used_count >= data.usage_limit) ||
      body.subtotal < data.minimum_order
    ) {
      return NextResponse.json({ error: "This code is invalid or does not apply to your order." }, { status: 400 });
    }

    const amount =
      data.kind === "percentage"
        ? Math.round((body.subtotal * data.amount) / 100)
        : Math.min(body.subtotal, data.amount);
    return NextResponse.json({ code: data.code, discount: amount });
  } catch (cause) {
    console.error("Discount validation is unavailable:", cause);
    return NextResponse.json({ error: "Could not validate this code right now." }, { status: 503 });
  }
}
