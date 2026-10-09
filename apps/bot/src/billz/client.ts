import { config } from "../config.js";
import { store } from "../store.js";

/**
 * BILLZ 2.0 REST API klienti.
 *
 * Hujjat: https://docs.billz.io (avvalgi: billzuz.notion.site API документация)
 *  • Kirish: POST /v1/auth/login {secret_token} → access_token (15 kun) + refresh_token.
 *  • Yangilash: POST /v2/auth/refresh (platform-id header bilan). Refresh token
 *    BIR MARTA ishlatiladi — qayta ishlatilsa butun sessiya oilasi bekor qilinadi,
 *    shuning uchun yangilash bitta joydan, navbat bilan qilinadi.
 *  • Limit: 2 so'rov/soniya (IP bo'yicha). Oshsa — 429; eksponensial kutib qayta urinamiz.
 */

const PLATFORM_ID = "7d4a4c38-dd84-4902-b744-0488b80a4c01";
const MIN_GAP_MS = 600; // ~1.6 so'rov/soniya — 2 rps chegarasidan pastda
const KV_TOKENS = "billz_tokens";

interface Tokens {
  access: string;
  refresh: string;
  /** ms epoch */
  expiresAt: number;
}

export class BillzError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
    this.name = "BillzError";
  }
  /** Sotuv xatolari `data.error_code` ichida keladi (masalan 20016 — qoldiq yetmaydi). */
  get errorCode(): number | null {
    const b = this.body as { data?: { error_code?: number } } | null;
    return b?.data?.error_code ?? null;
  }
}

let tokens: Tokens | null = null;
let authPromise: Promise<Tokens> | null = null;
let queue: Promise<unknown> = Promise.resolve();
let lastAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Barcha so'rovlarni ketma-ket navbatga qo'yadi (rate limit). */
function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastAt = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function rawJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

function pickTokens(body: unknown): Tokens {
  const d = (body as { data?: Record<string, unknown> })?.data ?? (body as Record<string, unknown>);
  const access = String(d?.access_token ?? "");
  const refresh = String(d?.refresh_token ?? "");
  const expiresIn = Number(d?.expires_in ?? 86400);
  if (!access) throw new BillzError("BILLZ: access_token qaytmadi", 500, body);
  // 1 soat zaxira bilan muddatini belgilaymiz.
  return { access, refresh, expiresAt: Date.now() + Math.max(60, expiresIn - 3600) * 1000 };
}

async function login(): Promise<Tokens> {
  if (!config.billz.secretToken) throw new BillzError("BILLZ_SECRET_TOKEN o'rnatilmagan", 0, null);
  const res = await throttle(() =>
    fetch(`${config.billz.apiUrl}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ secret_token: config.billz.secretToken }),
      signal: AbortSignal.timeout(30_000),
    }),
  );
  const body = await rawJson(res);
  if (!res.ok) throw new BillzError(`BILLZ login xato: ${res.status}`, res.status, body);
  return pickTokens(body);
}

async function refresh(t: Tokens): Promise<Tokens> {
  const res = await throttle(() =>
    fetch(`${config.billz.apiUrl}/v2/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "platform-id": PLATFORM_ID },
      body: JSON.stringify({ refresh_token: t.refresh }),
      signal: AbortSignal.timeout(30_000),
    }),
  );
  const body = await rawJson(res);
  if (!res.ok) throw new BillzError(`BILLZ refresh xato: ${res.status}`, res.status, body);
  return pickTokens(body);
}

/** Yaroqli tokenni qaytaradi; kerak bo'lsa yangilaydi yoki qayta kiradi (bitta joydan). */
async function getTokens(force = false): Promise<Tokens> {
  if (!force && tokens && tokens.expiresAt > Date.now()) return tokens;
  if (authPromise) return authPromise;
  authPromise = (async () => {
    try {
      if (!tokens) tokens = await store.kvGet<Tokens>(KV_TOKENS);
      if (!force && tokens && tokens.expiresAt > Date.now()) return tokens;
      let next: Tokens | null = null;
      if (tokens?.refresh) {
        try {
          next = await refresh(tokens);
        } catch (e) {
          console.warn("[billz] refresh muvaffaqiyatsiz, qayta login:", (e as Error).message);
        }
      }
      if (!next) next = await login();
      tokens = next;
      await store.kvSet(KV_TOKENS, next).catch(() => undefined);
      return next;
    } finally {
      authPromise = null;
    }
  })();
  return authPromise;
}

export interface BillzRequest {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Asinxron metodlar uchun `Billz-Response-Channel: HTTP` — javob shu so'rovda keladi. */
  asyncHttp?: boolean;
  timeoutMs?: number;
}

export async function billz<T = unknown>(path: string, opts: BillzRequest = {}): Promise<T> {
  const url = new URL(config.billz.apiUrl + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  let authRetried = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const t = await getTokens();
    const headers: Record<string, string> = {
      accept: "application/json",
      authorization: `Bearer ${t.access}`,
    };
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    if (opts.asyncHttp) headers["Billz-Response-Channel"] = "HTTP";

    const res = await throttle(() =>
      fetch(url, {
        method: opts.method ?? "GET",
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
      }),
    );

    if (res.status === 401 && !authRetried) {
      authRetried = true;
      await getTokens(true);
      continue;
    }
    if (res.status === 429 || res.status >= 502) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    const body = await rawJson(res);
    if (!res.ok) {
      const msg =
        (body as { error?: { message?: string } | string; message?: string })?.message ||
        JSON.stringify(body).slice(0, 300);
      throw new BillzError(`BILLZ ${opts.method ?? "GET"} ${path} → ${res.status}: ${msg}`, res.status, body);
    }
    // Asinxron konvertda xato `status_code`/`error.code` ichida bo'lishi mumkin.
    const env = body as { status_code?: number; error?: { code?: string; message?: string } } | null;
    if (opts.asyncHttp && env && typeof env.status_code === "number" && env.status_code >= 400) {
      throw new BillzError(`BILLZ ${path}: ${env.error?.message || env.status_code}`, env.status_code, body);
    }
    return body as T;
  }
  throw new BillzError(`BILLZ ${path}: juda ko'p urinish (429/5xx)`, 429, null);
}

/** BILLZ ulanishini tekshirish (admin /billz buyrug'i uchun). */
export async function billzPing(): Promise<{ ok: boolean; shops: { id: string; name: string }[]; error?: string }> {
  try {
    const r = await billz<{ shops?: { id: string; name: string }[] }>("/v1/shop", { query: { limit: 100 } });
    return { ok: true, shops: (r.shops ?? []).map((s) => ({ id: s.id, name: s.name })) };
  } catch (e) {
    return { ok: false, shops: [], error: (e as Error).message };
  }
}
