import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";
import { AuthError, requireUser } from "./auth.js";
import { store, type Lang } from "./store.js";
import { normLang } from "./i18n.js";
import {
  catalogStatus,
  getProductDetail,
  listCategories,
  listProducts,
  resolveImageKey,
  type Sort,
} from "./catalog/index.js";
import { createOrder, OrderError, serializeOrder, type OrderInput } from "./orders.js";
import { bots } from "./telegram.js";

/**
 * Mini App API (Gunesh shartnomasiga yaqin):
 *   GET  /api/config            do'kon sozlamalari + foydalanuvchi
 *   GET  /api/categories
 *   GET  /api/products          ?category=&q=&sort=popular|new|cheap|expensive&ids=a,b
 *   GET  /api/products/:id      to'liq ma'lumot + variantlar (o'lchamlar)
 *   POST /api/orders            buyurtma yaratish (initData majburiy)
 *   GET  /api/orders            mening buyurtmalarim
 *   GET  /api/orders/:id
 *   POST /api/lang              tanlangan tilni bot profiliga saqlash
 *   GET  /media/:id             sayt admin panelida yuklangan rasmlar (bazadan)
 *   GET  /img/:key              BILLZ rasmlari — o'z serverimizdan (BILLZ CDN'ga to'g'ridan-to'g'ri ulanish taqiqlangan)
 */

function langOf(req: FastifyRequest): Lang {
  return normLang((req.query as Record<string, string>).lang);
}

function sendError(reply: FastifyReply, e: unknown) {
  if (e instanceof AuthError || e instanceof OrderError) {
    return reply.code(e.statusCode).send({ detail: e.message });
  }
  reply.log.error(e);
  return reply.code(500).send({ detail: "Xatolik yuz berdi. Birozdan so‘ng qayta urinib ko‘ring." });
}

// Oddiy rate limit (foydalanuvchi bo'yicha, 1 daqiqa oynasi):
//  • urinishlar — 30 ta (xato to'g'rilanib qayta yuborilishi normal holat);
//  • yaratilgan buyurtmalar — 5 ta.
class Limiter {
  private hits = new Map<number, number[]>();
  constructor(private max: number, private windowMs = 60_000) {}
  private recent(id: number) {
    const now = Date.now();
    return (this.hits.get(id) ?? []).filter((t) => now - t < this.windowMs);
  }
  blocked(id: number) {
    return this.recent(id).length >= this.max;
  }
  hit(id: number) {
    const arr = this.recent(id);
    arr.push(Date.now());
    this.hits.set(id, arr);
    if (this.hits.size > 5000) this.hits.clear();
  }
}
const attemptLimiter = new Limiter(30);
const orderLimiter = new Limiter(5);

// Rasm keshi (xotira) — DB'ga har safar murojaat qilmaslik uchun.
const memImg = new Map<string, { type: string; data: Buffer }>();
const MEM_IMG_MAX = 300;
const inflight = new Map<string, Promise<{ type: string; data: Buffer } | null>>();

async function loadImage(key: string) {
  const mem = memImg.get(key);
  if (mem) return mem;
  const cached = await store.getMedia(key).catch(() => null);
  if (cached) {
    const v = { type: cached.contentType, data: cached.data };
    remember(key, v);
    return v;
  }
  const url = resolveImageKey(key);
  if (!url) return null;
  let p = inflight.get(key);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) return null;
        const type = res.headers.get("content-type") || "image/jpeg";
        if (!type.startsWith("image/")) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 8 * 1024 * 1024) return null;
        const v = { type, data: buf };
        remember(key, v);
        await store.putMedia({ key, contentType: type, data: buf }).catch(() => undefined);
        return v;
      } catch {
        return null;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, p);
  }
  return p;
}

function remember(key: string, v: { type: string; data: Buffer }) {
  if (memImg.size >= MEM_IMG_MAX) {
    const first = memImg.keys().next().value;
    if (first) memImg.delete(first);
  }
  memImg.set(key, v);
}

export async function registerApi(app: FastifyInstance) {
  app.addHook("onSend", async (req, reply, payload) => {
    if (req.url.startsWith("/api/")) reply.header("cache-control", "no-store");
    return payload;
  });

  app.get("/api/config", async (req, reply) => {
    try {
      let user = null as Awaited<ReturnType<typeof store.getUser>>;
      try {
        const tg = requireUser(req);
        user = await store.getUser(tg.id);
      } catch {
        /* katalogni ko'rish uchun auth shart emas */
      }
      const s = config.shop;
      const cat = catalogStatus();
      return {
        shop_name: s.name,
        currency: s.currency,
        phone: s.phone,
        admin_contact: s.adminContact,
        instagram: s.instagram,
        site_url: config.siteUrl,
        shop_address: s.address,
        shop_lat: s.lat || null,
        shop_lng: s.lng || null,
        working_hours: s.workingHours,
        delivery_fee: s.deliveryFee,
        free_delivery_from: s.freeDeliveryFrom,
        express_delivery_fee: s.expressDeliveryFee,
        min_order_amount: s.minOrderAmount,
        allow_pickup: s.allowPickup,
        maps_api_key: config.yandexMapsKey,
        payment_methods: [
          { id: "cash", enabled: true },
          { id: "click", enabled: s.clickEnabled },
        ],
        catalog_source: cat.source,
        bot_username: bots.customer?.botInfo?.username ?? "",
        // Lokal sinov: bot tokenlari yo'q bo'lsa brauzerda ham buyurtma berish mumkin.
        dev: !config.botToken && !config.adminBotToken && process.env.NODE_ENV !== "production",
        user_lang: user?.lang || null,
        user_phone: user?.phone || "",
        user_name: user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "",
      };
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.get("/api/categories", async (req) => listCategories(langOf(req)));

  app.get("/api/products", async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const ids = (q.ids ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 200);
    const sort = (["popular", "new", "cheap", "expensive"].includes(q.sort ?? "") ? q.sort : "popular") as Sort;
    return listProducts({ category: q.category || undefined, q: q.q?.slice(0, 100), sort, ids }, langOf(req));
  });

  app.get("/api/products/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = getProductDetail(id, langOf(req));
    if (!p) return reply.code(404).send({ detail: "Mahsulot topilmadi" });
    return p;
  });

  app.post("/api/orders", async (req, reply) => {
    try {
      const tg = requireUser(req);
      if (attemptLimiter.blocked(tg.id) || orderLimiter.blocked(tg.id)) {
        return reply.code(429).send({ detail: "Juda ko‘p urinish. Bir daqiqadan so‘ng qayta urinib ko‘ring." });
      }
      attemptLimiter.hit(tg.id);
      const order = await createOrder(tg, (req.body ?? {}) as OrderInput, langOf(req));
      orderLimiter.hit(tg.id);
      return serializeOrder(order);
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.get("/api/orders", async (req, reply) => {
    try {
      const tg = requireUser(req);
      const orders = await store.listOrdersByUser(tg.id, 50);
      return orders.map(serializeOrder);
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.get("/api/orders/:id", async (req, reply) => {
    try {
      const tg = requireUser(req);
      const o = await store.getOrder(Number((req.params as { id: string }).id));
      // IDOR himoyasi: faqat o'z buyurtmasi.
      if (!o || o.userId !== tg.id) return reply.code(404).send({ detail: "Buyurtma topilmadi" });
      return serializeOrder(o);
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post("/api/lang", async (req, reply) => {
    try {
      const tg = requireUser(req);
      const lang = normLang((req.body as { lang?: string })?.lang);
      await store.upsertUser({ telegramId: tg.id, lang });
      return { ok: true, lang };
    } catch (e) {
      return sendError(reply, e);
    }
  });

  // Qo'lda kiritilgan mahsulot rasmlari — bot bazasidan (sayt admin paneli yozadi).
  // ID har yuklashda yangi bo'ladi, shuning uchun uzoq kesh xavfsiz.
  app.get("/media/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!/^[a-f0-9]{32}$/.test(id)) return reply.code(404).send();
    const img = await store.getManualImage(id).catch(() => null);
    if (!img) return reply.code(404).send();
    reply.header("content-type", img.contentType);
    reply.header("cache-control", "public, max-age=31536000, immutable");
    reply.header("x-content-type-options", "nosniff");
    return reply.send(img.data);
  });

  app.get("/img/:key", async (req, reply) => {
    const { key } = req.params as { key: string };
    if (!/^[a-f0-9]{32}$/.test(key)) return reply.code(404).send();
    const img = await loadImage(key);
    if (!img) return reply.code(404).send();
    reply.header("content-type", img.type);
    reply.header("cache-control", "public, max-age=604800, immutable");
    return reply.send(img.data);
  });
}
