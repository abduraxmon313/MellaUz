import { createHash } from "node:crypto";
import { Composer, InlineKeyboard, InputFile, type Context } from "grammy";
import { config, hasBillz, hasOpenAI } from "../config.js";
import { LISTING_MAX_IMAGES, store } from "../store.js";
import {
  catalogStatus,
  findByCode,
  getBaseProduct,
  listingFor,
  loc,
  refreshListings,
  stockByShop,
} from "../catalog/index.js";
import type { Product } from "../catalog/types.js";
import { AiImageError, cleanProductPhoto } from "../ai/image.js";
import { esc, money } from "../util.js";

/**
 * Admin bot: BILLZ mahsulotini Mini App'ga qo'shish.
 *
 *  1. Admin BILLZ kodini yuboradi (artikul/SKU, shtrix-kod yoki tovar ID; topilmasa — nomi bo'yicha qidiriladi).
 *  2. Bot mahsulotni ko'rsatadi va rasm so'raydi.
 *  3. Rasm OpenAI'ga yuboriladi: fon va ortiqcha narsalar olib tashlanadi.
 *  4. Natija adminga keladi: ✅ Tasdiqlash / 🔁 Qayta / 📷 Asl rasm / ❌ Bekor.
 *  5. Tasdiqlangach rasm bazaga yoziladi va mahsulot Mini App'da ko'rina boshlaydi.
 *     Yana rasm yuborilsa — shu mahsulotga qo'shiladi (galereya).
 *
 * Holat (sessiya) xotirada: server qayta ishga tushsa, admin kodni qaytadan yuboradi.
 */

export const BTN_ADD = "➕ Mahsulot qo‘shish";

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

interface Session {
  key: string;
  step: "photo" | "busy" | "review";
  /** Har yangi mahsulot/ishlovda oshadi — eski fon ishi natijasi e'tiborsiz qoldiriladi. */
  token: number;
  original?: { data: Buffer; mime: string };
  result?: { data: Buffer; contentType: string };
  saving?: boolean;
}

const sessions = new Map<number, Session>();
let tokenSeq = 0;

const safetyId = (adminId: number) => createHash("sha256").update(`mella-admin:${adminId}`).digest("hex").slice(0, 32);

// ── Ko'rinish ───────────────────────────────────────────────

function productText(p: Product): string {
  const l = listingFor(p);
  const prices = p.variants.map((v) => v.price).filter((x) => x > 0);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;
  const stock = p.variants.reduce((s, v) => s + v.stock, 0);
  const sizes = p.variants
    .filter((v) => v.label)
    .slice(0, 25)
    .map((v) => `${esc(v.label)}${v.stock > 0 ? ` (${v.stock})` : " (0)"}`)
    .join(", ");
  const status = !l
    ? "⏳ Mini App’da hali yo‘q"
    : l.published && l.imageIds.length
      ? `✅ Mini App’da ko‘rinmoqda · ${l.imageIds.length} ta rasm`
      : l.imageIds.length
        ? `🚫 Yashirilgan · ${l.imageIds.length} ta rasm`
        : "⏳ Rasm yo‘q";
  return [
    `📦 <b>${esc(loc(p.name, "uz"))}</b>`,
    p.sku ? `Artikul: <code>${esc(p.sku)}</code>` : "",
    p.brand ? `Brend: ${esc(p.brand)}` : "",
    `Narx: <b>${min === max ? money(min) : `${money(min)} – ${money(max)}`}</b>`,
    sizes ? `O‘lchamlar: ${sizes}` : "",
    `Mini App qoldig‘i: <b>${stock}</b>${stock > 0 ? "" : " — «Tugagan» ko‘rinadi"}`,
    shopStockText(p, stock),
  ]
    .filter(Boolean)
    .join("\n")
    .concat(`\n\nHolat: ${status}`);
}

/** Filiallar kesimida qoldiq. Mini App hisoblamaydigan filialda tovar bo'lsa — ogohlantiramiz. */
function shopStockText(p: Product, counted: number): string {
  const rows = stockByShop(p);
  if (!rows.length) return "";
  const lines = rows
    .slice(0, 12)
    .map((r) => `${r.counted ? "•" : "◦"} ${esc(r.name)}: ${r.stock}${r.counted ? "" : " <i>(Mini App’da hisoblanmaydi)</i>"}`);
  const hidden = rows.filter((r) => !r.counted).reduce((s, r) => s + r.stock, 0);
  const warn =
    counted === 0 && hidden > 0
      ? "\n⚠️ Tovar BILLZ_SHOP_IDS’ga kirmagan filialda turibdi. Mini App’da ko‘rinishi uchun o‘sha filial ID’sini (/billz) BILLZ_SHOP_IDS’ga qo‘shing."
      : "";
  return `Filiallar bo‘yicha:\n${lines.join("\n")}${warn}`;
}

function productKeyboard(p: Product) {
  const l = listingFor(p);
  const kb = new InlineKeyboard();
  if (l && l.imageIds.length) {
    if (l.published) kb.text("🚫 Mini App’dan yashirish", `pp:h:${p.id}`);
    else kb.text("👁 Mini App’da ko‘rsatish", `pp:v:${p.id}`);
    kb.row().text("🗑 Rasmlarni o‘chirish", `pp:c:${p.id}`);
  }
  return kb;
}

function reviewKeyboard(key: string, hasResult: boolean) {
  const kb = new InlineKeyboard();
  if (hasResult) kb.text("✅ Tasdiqlash", `pp:ok:${key}`).row();
  if (hasOpenAI) kb.text(hasResult ? "🔁 Qayta ishlash" : "🔁 Qayta urinish", `pp:re:${key}`);
  kb.text("📷 Asl rasm", `pp:or:${key}`).row();
  kb.text("❌ Bekor qilish", `pp:no:${key}`);
  return kb;
}

const doneKeyboard = () => new InlineKeyboard().text("✅ Tugatish", "pp:end");

async function showProduct(ctx: Context, p: Product) {
  const adminId = ctx.from!.id;
  sessions.set(adminId, { key: p.id, step: "photo", token: ++tokenSeq });
  const l = listingFor(p);
  const count = l?.imageIds.length ?? 0;
  const ask =
    count >= LISTING_MAX_IMAGES
      ? `\n\n⚠️ Rasm chegarasiga yetildi (${LISTING_MAX_IMAGES}). Yangi rasm qo‘shish uchun avval rasmlarni o‘chiring.`
      : count
        ? "\n\n📷 Yangi rasm yuborsangiz — galereyaga qo‘shiladi."
        : "\n\n📷 Endi mahsulot rasmini yuboring (oddiy rasm yoki fayl sifatida).";
  await ctx.reply(productText(p) + ask, { parse_mode: "HTML", reply_markup: productKeyboard(p) });
}

// ── Qidiruv ─────────────────────────────────────────────────

/** Kod bo'yicha qidiradi. Bitta aniq moslik bo'lsa mahsulotni qaytaradi; aks holda javobni o'zi yuboradi. */
async function lookup(ctx: Context, code: string): Promise<Product | null> {
  const st = catalogStatus();
  const r = findByCode(code);
  if (!r.products.length) {
    const hint =
      hasBillz && st.loading
        ? `\n\n⏳ BILLZ katalogi hali yuklanmoqda (${st.loading}). Birozdan so‘ng qayta urinib ko‘ring.`
        : "";
    await ctx.reply(
      `🔍 «${esc(code)}» bo‘yicha mahsulot topilmadi.\n\nBILLZ’dagi artikul (SKU), shtrix-kod yoki mahsulot nomini yuboring.${hint}`,
      { parse_mode: "HTML" },
    );
    return null;
  }
  if (r.exact && r.products.length === 1) return r.products[0]!;

  const kb = new InlineKeyboard();
  for (const p of r.products) {
    const l = listingFor(p);
    const mark = l?.published && l.imageIds.length ? "✅ " : "";
    kb.text(`${mark}${loc(p.name, "uz").slice(0, 40)}${p.sku ? ` · ${p.sku}` : ""}`.slice(0, 60), `pp:s:${p.id}`).row();
  }
  await ctx.reply(
    r.exact ? "Bir nechta mahsulot mos keldi — tanlang:" : `«${esc(code)}» nomi bo‘yicha topilganlar — tanlang:`,
    { parse_mode: "HTML", reply_markup: kb },
  );
  return null;
}

// ── Rasm ────────────────────────────────────────────────────

async function downloadTelegramFile(ctx: Context, fileId: string): Promise<Buffer> {
  const f = await ctx.api.getFile(fileId);
  if (!f.file_path) throw new Error("Telegram fayl yo‘lini bermadi");
  // Diqqat: URL ichida bot tokeni bor — log'ga yozilmaydi.
  const res = await fetch(`https://api.telegram.org/file/bot${config.adminBotToken}/${f.file_path}`, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Telegram fayl yuklanmadi (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_PHOTO_BYTES) throw new Error("Rasm juda katta (15 MB dan oshmasin)");
  return buf;
}

/** Fon ishi: AI'ga yuborib, natijani adminga jo'natadi. Webhook javobini kutib turmaydi. */
function runAi(ctx: Context, s: Session) {
  const chatId = ctx.chat!.id;
  const adminId = ctx.from!.id;
  const token = ++tokenSeq;
  s.token = token;
  s.step = "busy";
  s.result = undefined;
  const original = s.original!;
  const key = s.key;

  void (async () => {
    const wait = await ctx.api
      .sendMessage(chatId, "⏳ AI rasmga ishlov bermoqda (fon tozalanmoqda). Odatda 30–90 soniya…")
      .catch(() => null);
    const typing = setInterval(() => void ctx.api.sendChatAction(chatId, "upload_photo").catch(() => undefined), 5000);
    void ctx.api.sendChatAction(chatId, "upload_photo").catch(() => undefined);
    try {
      const out = await cleanProductPhoto(original.data, original.mime, { safetyId: safetyId(adminId) });
      if (sessions.get(adminId)?.token !== token) return; // admin boshqa mahsulotga o'tib ketgan
      s.result = out;
      s.step = "review";
      const p = getBaseProduct(key);
      await ctx.api.sendPhoto(chatId, new InputFile(out.data, "mella.jpg"), {
        caption: `✨ <b>${esc(p ? loc(p.name, "uz") : key)}</b>\n\nNatija ma’qulmi? Tasdiqlasangiz Mini App’da shu rasm bilan ko‘rinadi.`,
        parse_mode: "HTML",
        reply_markup: reviewKeyboard(key, true),
      });
    } catch (e) {
      if (sessions.get(adminId)?.token !== token) return;
      s.step = "review";
      const msg = e instanceof AiImageError ? e.message : `Kutilmagan xato: ${(e as Error).message}`;
      if (!(e instanceof AiImageError)) console.error("[admin-products] AI xato:", e);
      await ctx.api
        .sendMessage(chatId, `⚠️ AI ishlov bera olmadi.\n<code>${esc(msg.slice(0, 400))}</code>`, {
          parse_mode: "HTML",
          reply_markup: reviewKeyboard(key, false),
        })
        .catch(() => undefined);
    } finally {
      clearInterval(typing);
      if (wait) void ctx.api.deleteMessage(chatId, wait.message_id).catch(() => undefined);
    }
  })();
}

async function onPhoto(ctx: Context, fileId: string, mime: string, size: number | undefined, caption: string) {
  const adminId = ctx.from!.id;

  // Rasm izohida kod bo'lsa — mahsulotni shu yerning o'zida tanlaymiz.
  const code = caption.trim().slice(0, 100);
  if (code && sessions.get(adminId)?.step !== "busy") {
    const r = findByCode(code);
    if (r.exact && r.products.length === 1) {
      const p = r.products[0]!;
      if (sessions.get(adminId)?.key !== p.id) {
        sessions.set(adminId, { key: p.id, step: "photo", token: ++tokenSeq });
        await ctx.reply(productText(p), { parse_mode: "HTML" });
      }
    } else if (!sessions.has(adminId)) {
      await lookup(ctx, code); // topilmadi yoki tanlash ro'yxati
      return;
    }
  }

  const s = sessions.get(adminId);
  if (!s) {
    await ctx.reply(`Avval mahsulotning BILLZ kodini yuboring (yoki «${BTN_ADD}» tugmasi), keyin rasmni.`);
    return;
  }
  if (s.step === "busy") {
    await ctx.reply("⏳ Oldingi rasm hali ishlanmoqda — natijani kuting.");
    return;
  }
  const p = getBaseProduct(s.key);
  if (!p) {
    sessions.delete(adminId);
    await ctx.reply("⚠️ Mahsulot katalogda topilmadi (BILLZ’dan o‘chirilgan bo‘lishi mumkin). Kodni qayta yuboring.");
    return;
  }
  if ((listingFor(p)?.imageIds.length ?? 0) >= LISTING_MAX_IMAGES) {
    await ctx.reply(`⚠️ Bu mahsulotda ${LISTING_MAX_IMAGES} ta rasm bor. Avval rasmlarni o‘chiring.`);
    return;
  }
  if (!ALLOWED_MIME.includes(mime)) {
    await ctx.reply("⚠️ Faqat JPG, PNG yoki WEBP rasm yuboring.");
    return;
  }
  if (size && size > MAX_PHOTO_BYTES) {
    await ctx.reply("⚠️ Rasm juda katta (15 MB dan oshmasin).");
    return;
  }

  try {
    s.original = { data: await downloadTelegramFile(ctx, fileId), mime };
  } catch (e) {
    await ctx.reply(`⚠️ Rasmni olib bo‘lmadi: ${esc((e as Error).message)}`);
    return;
  }

  if (!hasOpenAI) {
    s.step = "review";
    await ctx.reply(
      "ℹ️ OPENAI_API_KEY o‘rnatilmagan — AI ishlovi o‘chiq. Asl rasmni ishlatishingiz mumkin.",
      { reply_markup: reviewKeyboard(s.key, false) },
    );
    return;
  }
  runAi(ctx, s);
}

/** Tasdiqlangan rasmni saqlaydi va mahsulotni Mini App'da ko'rsatadi. */
async function saveImage(ctx: Context, s: Session, image: { data: Buffer; contentType: string }) {
  const p = getBaseProduct(s.key);
  if (!p) {
    await ctx.answerCallbackQuery({ text: "Mahsulot katalogda topilmadi", show_alert: true });
    return;
  }
  s.saving = true;
  try {
    await store.addListingImage(
      {
        key: p.id,
        variantIds: p.variants.map((v) => v.id),
        sku: p.sku,
        name: loc(p.name, "uz"),
        createdBy: ctx.from!.id,
      },
      image,
    );
    await refreshListings();
  } catch (e) {
    await ctx.answerCallbackQuery({ text: `Saqlanmadi: ${(e as Error).message}`.slice(0, 190), show_alert: true });
    return;
  } finally {
    s.saving = false;
  }
  s.step = "photo";
  s.original = undefined;
  s.result = undefined;
  s.token = ++tokenSeq;

  await ctx.answerCallbackQuery({ text: "✅ Saqlandi" });
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
  const n = listingFor(p)?.imageIds.length ?? 1;
  await ctx.reply(
    `✅ <b>${esc(loc(p.name, "uz"))}</b> Mini App’da ko‘rinmoqda (${n}-rasm).\n\nYana rasm yuborsangiz — shu mahsulotga qo‘shiladi. Boshqa mahsulot uchun yangi kod yuboring.`,
    { parse_mode: "HTML", reply_markup: doneKeyboard() },
  );
}

// ── Composer ────────────────────────────────────────────────

export function productComposer() {
  const c = new Composer<Context>();

  const start = async (ctx: Context) => {
    sessions.delete(ctx.from!.id);
    const st = catalogStatus();
    const lines = [
      "➕ <b>Mahsulot qo‘shish</b>",
      "",
      "BILLZ’dagi mahsulot kodini yuboring: artikul (SKU), shtrix-kod yoki nomi.",
      "Keyin rasm so‘rayman — AI fonini tozalaydi, siz tasdiqlaysiz va mahsulot Mini App’da chiqadi.",
      "",
      `Mini App’da: <b>${st.approvedProducts}</b> ta tasdiqlangan mahsulot${st.billzTotal ? ` (BILLZ’da ${st.billzTotal} ta karta)` : ""}.`,
      hasOpenAI ? "" : "\n⚠️ OPENAI_API_KEY o‘rnatilmagan — AI ishlovi o‘chiq, faqat asl rasm saqlanadi.",
    ];
    await ctx.reply(lines.join("\n").trim(), { parse_mode: "HTML" });
  };
  c.command("add", start);
  c.hears(BTN_ADD, start);

  c.callbackQuery(/^pp:s:(.+)$/, async (ctx) => {
    const p = getBaseProduct(ctx.match[1]!);
    await ctx.answerCallbackQuery();
    if (!p) return void (await ctx.reply("⚠️ Mahsulot topilmadi. Kodni qayta yuboring."));
    await showProduct(ctx, p);
  });

  c.callbackQuery(/^pp:(ok|re|or|no):(.+)$/, async (ctx) => {
    const action = ctx.match[1]!;
    const key = ctx.match[2]!;
    const s = sessions.get(ctx.from.id);
    if (!s || s.key !== key) {
      await ctx.answerCallbackQuery({ text: "Bu eski xabar. Kodni qayta yuboring.", show_alert: true });
      return;
    }
    if (s.saving) return void (await ctx.answerCallbackQuery({ text: "Saqlanmoqda…" }));
    if (s.step === "busy") return void (await ctx.answerCallbackQuery({ text: "⏳ Ishlanmoqda, kuting" }));

    if (action === "ok") {
      if (!s.result) return void (await ctx.answerCallbackQuery({ text: "Allaqachon saqlangan yoki natija yo‘q" }));
      await saveImage(ctx, s, s.result);
      return;
    }
    if (action === "or") {
      if (!s.original) return void (await ctx.answerCallbackQuery({ text: "Asl rasm yo‘q — rasmni qayta yuboring" }));
      await saveImage(ctx, s, { data: s.original.data, contentType: s.original.mime });
      return;
    }
    if (action === "re") {
      if (!s.original) return void (await ctx.answerCallbackQuery({ text: "Asl rasm yo‘q — rasmni qayta yuboring" }));
      if (!hasOpenAI) return void (await ctx.answerCallbackQuery({ text: "OPENAI_API_KEY o‘rnatilmagan", show_alert: true }));
      await ctx.answerCallbackQuery({ text: "🔁 Qayta ishlanmoqda" });
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
      runAi(ctx, s);
      return;
    }
    // no — natijani tashlab yuborish
    s.step = "photo";
    s.original = undefined;
    s.result = undefined;
    await ctx.answerCallbackQuery({ text: "Bekor qilindi" });
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
    await ctx.reply("📷 Boshqa rasm yuboring yoki yangi mahsulot kodini yozing.", { reply_markup: doneKeyboard() });
  });

  c.callbackQuery("pp:end", async (ctx) => {
    sessions.delete(ctx.from.id);
    await ctx.answerCallbackQuery({ text: "Tayyor" });
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
    await ctx.reply(`👌 Tayyor. Keyingi mahsulot uchun kodini yuboring yoki «${BTN_ADD}».`);
  });

  c.callbackQuery(/^pp:(h|v):(.+)$/, async (ctx) => {
    const p = getBaseProduct(ctx.match[2]!);
    const l = p ? listingFor(p) : null;
    if (!p || !l) return void (await ctx.answerCallbackQuery({ text: "Topilmadi", show_alert: true }));
    const show = ctx.match[1] === "v";
    await store.setListingPublished(l.key, show);
    await refreshListings();
    await ctx.answerCallbackQuery({ text: show ? "👁 Ko‘rsatilmoqda" : "🚫 Yashirildi" });
    await ctx.editMessageText(productText(p), { parse_mode: "HTML", reply_markup: productKeyboard(p) }).catch(() => undefined);
  });

  c.callbackQuery(/^pp:c:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx
      .editMessageReplyMarkup({
        reply_markup: new InlineKeyboard()
          .text("🗑 Ha, o‘chirish", `pp:cc:${ctx.match[1]}`)
          .text("↩️ Yo‘q", `pp:cb:${ctx.match[1]}`),
      })
      .catch(() => undefined);
  });

  c.callbackQuery(/^pp:(cc|cb):(.+)$/, async (ctx) => {
    const p = getBaseProduct(ctx.match[2]!);
    if (!p) return void (await ctx.answerCallbackQuery({ text: "Topilmadi", show_alert: true }));
    const l = listingFor(p);
    if (ctx.match[1] === "cc" && l) {
      await store.clearListingImages(l.key);
      await refreshListings();
      await ctx.answerCallbackQuery({ text: "🗑 Rasmlar o‘chirildi — Mini App’dan olib tashlandi" });
    } else {
      await ctx.answerCallbackQuery();
    }
    await ctx.editMessageText(productText(p), { parse_mode: "HTML", reply_markup: productKeyboard(p) }).catch(() => undefined);
  });

  c.on("message:photo", async (ctx) => {
    const ph = ctx.message.photo.at(-1)!; // eng katta o'lcham
    await onPhoto(ctx, ph.file_id, "image/jpeg", ph.file_size, ctx.message.caption ?? "");
  });

  c.on("message:document", async (ctx) => {
    const d = ctx.message.document;
    if (!d.mime_type?.startsWith("image/")) {
      await ctx.reply("⚠️ Faqat rasm (JPG, PNG, WEBP) yuboring.");
      return;
    }
    await onPhoto(ctx, d.file_id, d.mime_type, d.file_size, ctx.message.caption ?? "");
  });

  // Boshqa har qanday matn — BILLZ kodi deb qabul qilinadi.
  c.on("message:text", async (ctx, next) => {
    const text = ctx.message.text.trim();
    if (!text || text.startsWith("/")) return next();
    const p = await lookup(ctx, text.slice(0, 100));
    if (p) await showProduct(ctx, p);
  });

  return c;
}
