import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * /admin kirish — bitta parol (ADMIN_PASSWORD), imzolangan HttpOnly cookie.
 * Parol o'zgartirilsa — barcha eski sessiyalar avtomatik bekor bo'ladi.
 */
export const ADMIN_COOKIE = "mella_admin";
const SESSION_DAYS = 7;

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function secret(): Buffer {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const extra = process.env.ADMIN_SESSION_SECRET ?? "";
  return createHash("sha256").update(`mella-admin:${password}:${extra}`).digest();
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(input: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  // Uzunlik farqini ham yashirish uchun xeshlarni solishtiramiz.
  const h = (v: string) => createHash("sha256").update(v).digest("hex");
  return safeEqual(h(input), h(expected));
}

export function createSessionToken() {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  return { token: `${exp}.${sign(String(exp))}`, maxAge: SESSION_DAYS * 86_400 };
}

export function verifyToken(token: string | undefined | null) {
  if (!token || !adminConfigured()) return false;
  const [exp, mac] = token.split(".");
  if (!exp || !mac || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(mac, sign(exp));
}

export async function isAdmin() {
  const store = await cookies();
  return verifyToken(store.get(ADMIN_COOKIE)?.value);
}

/** Admin sahifalari uchun: kirmagan bo'lsa — /admin/login. */
export async function requireAdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");
}

/**
 * API uchun: sessiya + CSRF himoyasi (o'zgartiruvchi so'rov boshqa saytdan kelmasin).
 * Xato bo'lsa — javob (Response), aks holda null.
 */
export function guardApi(req: Request): Response | null {
  const cookie = req.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1);
  if (!verifyToken(token ? decodeURIComponent(token) : null)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return Response.json({ ok: false, error: "bad_origin" }, { status: 403 });
    }
  }
  return null;
}
