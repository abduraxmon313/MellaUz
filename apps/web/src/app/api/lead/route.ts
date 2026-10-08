import { NextResponse } from "next/server";
import { leadSchema } from "@/lib/lead-schema";
import { rateLimit } from "@/lib/rate-limit";
import { saveLead } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = rateLimit(`lead:${ip}`, 5, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  // Honeypot to'ldirilgan bo'lsa — bot. Jim muvaffaqiyat qaytaramiz.
  if (parsed.data.company) {
    return NextResponse.json({ ok: true });
  }

  const { name, phone, product, note, locale } = parsed.data;
  try {
    await saveLead({
      name,
      phone,
      product: product || undefined,
      note: note || undefined,
      locale,
      source: "website",
    });
  } catch (err) {
    console.error("[api/lead] saveLead xatosi:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
