import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validText(value: unknown, min: number, max: number) {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid order request." }, { status: 400 });
  }

  if (
    !isRecord(body) ||
    !isRecord(body.customer) ||
    !Array.isArray(body.items) ||
    body.items.length < 1 ||
    body.items.length > 50 ||
    !validText(body.customer.name, 2, 120) ||
    !validText(body.customer.phone, 5, 30) ||
    !validText(body.customer.address, 8, 350) ||
    !validText(body.customer.city, 2, 100) ||
    (body.customer.email !== undefined &&
      body.customer.email !== "" &&
      (typeof body.customer.email !== "string" ||
        body.customer.email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customer.email))) ||
    (body.customer.note !== undefined &&
      (typeof body.customer.note !== "string" || body.customer.note.length > 500)) ||
    !["cod", "bank_transfer"].includes(String(body.paymentMethod)) ||
    (body.discountCode !== undefined &&
      (typeof body.discountCode !== "string" || body.discountCode.length > 40))
  ) {
    return NextResponse.json({ error: "Please check your contact and delivery details." }, { status: 400 });
  }

  const items = body.items;
  if (
    !items.every(
      (item) =>
        isRecord(item) &&
        typeof item.productId === "string" &&
        uuidPattern.test(item.productId) &&
        Number.isInteger(item.quantity) &&
        Number(item.quantity) >= 1 &&
        Number(item.quantity) <= 99,
    )
  ) {
    return NextResponse.json({ error: "Your cart contains an invalid item." }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.rpc("place_store_order", {
      p_customer: {
        name: body.customer.name,
        email: body.customer.email ?? "",
        phone: body.customer.phone,
        address: body.customer.address,
        city: body.customer.city,
        note: body.customer.note ?? "",
      },
      p_items: items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
      })),
      p_discount_code: body.discountCode ?? "",
      p_payment_method: body.paymentMethod,
    });

    if (error) {
      if (/invalid|out of stock|unavailable|quantity/i.test(error.message)) {
        return NextResponse.json({ error: "A cart item or discount is no longer available. Please review your cart." }, { status: 409 });
      }
      console.error("Order creation failed:", error.message);
      return NextResponse.json({ error: "Your order could not be created. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ order: data }, { status: 201 });
  } catch (cause) {
    console.error("Checkout is unavailable:", cause);
    return NextResponse.json({ error: "Checkout is unavailable. Please try again later." }, { status: 503 });
  }
}
