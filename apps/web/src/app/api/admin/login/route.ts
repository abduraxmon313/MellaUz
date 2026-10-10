import { ADMIN_COOKIE, adminConfigured, checkPassword, createSessionToken } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!adminConfigured()) {
    return Response.json({ ok: false, error: "ADMIN_PASSWORD sozlanmagan" }, { status: 503 });
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || "unknown";
  const limit = rateLimit(`admin-login:${ip}`, 8, 15 * 60_000);
  if (!limit.ok) {
    return Response.json(
      { ok: false, error: `Juda ko‘p urinish. ${Math.ceil(limit.retryAfter / 60)} daqiqadan so‘ng qayta urining.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
  let password = "";
  try {
    password = String(((await req.json()) as { password?: unknown }).password ?? "");
  } catch {
    return Response.json({ ok: false, error: "Noto‘g‘ri so‘rov" }, { status: 400 });
  }
  if (!checkPassword(password)) {
    return Response.json({ ok: false, error: "Parol noto‘g‘ri" }, { status: 401 });
  }
  const { token, maxAge } = createSessionToken();
  const secure = process.env.NODE_ENV === "production" && !/^http:\/\/(localhost|127\.)/.test(req.headers.get("origin") ?? "");
  const cookie = [
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
  return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
}
