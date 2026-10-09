import { Bot, Composer, Keyboard, type Context } from "grammy";
import { config } from "../config.js";
import { store, ORDER_STATUSES, type OrderStatus } from "../store.js";
import { changeStatus } from "../orders.js";
import { ACTIVE_STATUSES } from "../status.js";
import { catalogStatus, syncNow } from "../catalog/index.js";
import { billzPing } from "../billz/client.js";
import { esc, money, tashkentDate } from "../util.js";
import { ADMIN_STATUS, CANCEL_REASONS, orderCardKeyboard, orderCardText, reasonKeyboard } from "./card.js";

/**
 * Admin bot — buyurtmalarni boshqarish.
 *  • Yangi buyurtma kartasi barcha adminlarga keladi (notify.ts), tugmalar bilan
 *    holat o'zgartiriladi; karta HAMMA adminlarda bir vaqtda yangilanadi.
 *  • Rad etish / bekor qilishda sabab so'raladi va mijozga yuboriladi.
 *  • /orders — faol buyurtmalar, /today — bugungi hisobot,
 *    /sync — BILLZ katalogini yangilash, /billz — ulanish va do'konlar ro'yxati.
 *
 * Faqat ADMIN_IDS ro'yxatidagilar foydalana oladi.
 */

const BTN_ACTIVE = "📋 Faol buyurtmalar";
const BTN_NEW = "🆕 Yangilar";
const BTN_TODAY = "📊 Bugun";
const BTN_SYNC = "🔄 Katalog (BILLZ)";

/** Admin "boshqa sabab" yozayotgan bo'lsa: adminId → buyurtma va holat. */
const pendingReason = new Map<number, { orderId: number; status: OrderStatus }>();

const isAdmin = (id: number | undefined) => Boolean(id && config.adminIds.includes(id));

function adminMenu() {
  return new Keyboard().text(BTN_ACTIVE).text(BTN_NEW).row().text(BTN_TODAY).text(BTN_SYNC).resized().persistent();
}

function parseStatus(s: string | undefined): OrderStatus | null {
  return s && (ORDER_STATUSES as readonly string[]).includes(s) ? (s as OrderStatus) : null;
}

async function sendCards(ctx: Context, statuses: OrderStatus[], emptyText: string) {
  const orders = await store.listOrdersByStatus(statuses, 15);
  if (!orders.length) {
    await ctx.reply(emptyText);
    return;
  }
  for (const o of orders.reverse()) {
    const m = await ctx.reply(orderCardText(o), { parse_mode: "HTML", reply_markup: orderCardKeyboard(o) });
    await store.addAdminCard({ orderId: o.id, chatId: ctx.chat!.id, messageId: m.message_id });
  }
}

async function todayReport(ctx: Context) {
  // Toshkent vaqti bo'yicha bugungi kun boshi (UTC+5).
  const now = new Date();
  const tk = new Date(now.getTime() + 5 * 3600_000);
  const start = new Date(Date.UTC(tk.getUTCFullYear(), tk.getUTCMonth(), tk.getUTCDate()) - 5 * 3600_000);
  const orders = await store.listOrdersSince(start.toISOString());
  const by = new Map<OrderStatus, number>();
  for (const o of orders) by.set(o.status, (by.get(o.status) ?? 0) + 1);
  const ok = orders.filter((o) => o.status !== "canceled" && o.status !== "rejected");
  const delivered = orders.filter((o) => o.status === "delivered");
  const lines = [
    `📊 <b>Bugun (${tashkentDate(now.toISOString()).split(",")[0]})</b>`,
    "",
    `Buyurtmalar: <b>${orders.length}</b>`,
    `Faol + yetkazilgan summa: <b>${money(ok.reduce((s, o) => s + o.grandTotal, 0))}</b>`,
    `Yetkazilgan: <b>${delivered.length}</b> · ${money(delivered.reduce((s, o) => s + o.grandTotal, 0))}`,
    "",
    ...ORDER_STATUSES.filter((s) => by.get(s)).map((s) => `${ADMIN_STATUS[s]}: ${by.get(s)}`),
  ];
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

async function syncReport(ctx: Context) {
  const before = catalogStatus();
  if (before.source !== "billz" && !config.billz.secretToken) {
    await ctx.reply("ℹ️ BILLZ_SECRET_TOKEN o‘rnatilmagan — Mini App namuna katalog bilan ishlayapti.");
    return;
  }
  await ctx.reply("🔄 BILLZ katalogi yangilanmoqda…");
  await syncNow();
  const s = catalogStatus();
  await ctx.reply(
    [
      s.lastError ? "⚠️ <b>Xato bilan yakunlandi</b>" : "✅ <b>Katalog yangilandi</b>",
      `Manba: ${s.source}`,
      `Mahsulotlar: ${s.products}`,
      `Kategoriyalar: ${s.categories}`,
      `Oxirgi sinxron: ${tashkentDate(s.syncedAt)}`,
      s.lastError ? `\nXato: <code>${esc(s.lastError.slice(0, 500))}</code>` : "",
    ].join("\n"),
    { parse_mode: "HTML" },
  );
}

/** Holat o'zgartirish tugmalari (admin bot ham, zaxira rejimida mijoz boti ham ishlatadi). */
function callbackHandlers() {
  const c = new Composer<Context>();

  c.callbackQuery(/^(st|rs|cx|cw|bk):/, async (ctx, next) => {
    if (!isAdmin(ctx.from.id)) {
      await ctx.answerCallbackQuery({ text: "Ruxsat yo‘q", show_alert: true });
      return;
    }
    await next();
  });

  c.callbackQuery(/^st:(\d+):(\w+)$/, async (ctx) => {
    const status = parseStatus(ctx.match[2]);
    if (!status) return ctx.answerCallbackQuery();
    try {
      const r = await changeStatus(Number(ctx.match[1]), status, ctx.from.id);
      await ctx.answerCallbackQuery({ text: r.error ?? (r.changed ? ADMIN_STATUS[status] : "O‘zgarmadi"), show_alert: Boolean(r.error) });
      if (!r.changed) {
        await ctx
          .editMessageText(orderCardText(r.order), { parse_mode: "HTML", reply_markup: orderCardKeyboard(r.order) })
          .catch(() => undefined);
      }
    } catch (e) {
      await ctx.answerCallbackQuery({ text: (e as Error).message, show_alert: true });
    }
  });

  c.callbackQuery(/^rs:(\d+):(canceled|rejected)$/, async (ctx) => {
    const o = await store.getOrder(Number(ctx.match[1]));
    if (!o) return ctx.answerCallbackQuery({ text: "Topilmadi" });
    await ctx.answerCallbackQuery({ text: "Sababni tanlang" });
    await ctx.editMessageReplyMarkup({ reply_markup: reasonKeyboard(o, ctx.match[2] as OrderStatus) }).catch(() => undefined);
  });

  c.callbackQuery(/^cx:(\d+):(canceled|rejected):(\d+)$/, async (ctx) => {
    const reason = CANCEL_REASONS[Number(ctx.match[3])] ?? "";
    try {
      const r = await changeStatus(Number(ctx.match[1]), ctx.match[2] as OrderStatus, ctx.from.id, reason);
      await ctx.answerCallbackQuery({ text: r.error ?? ADMIN_STATUS[ctx.match[2] as OrderStatus], show_alert: Boolean(r.error) });
    } catch (e) {
      await ctx.answerCallbackQuery({ text: (e as Error).message, show_alert: true });
    }
  });

  c.callbackQuery(/^cw:(\d+):(canceled|rejected)$/, async (ctx) => {
    pendingReason.set(ctx.from.id, { orderId: Number(ctx.match[1]), status: ctx.match[2] as OrderStatus });
    await ctx.answerCallbackQuery();
    await ctx.reply(`✍️ #${Number(ctx.match[1]) + 1000} buyurtma uchun sababni bitta xabarda yozing:`);
  });

  c.callbackQuery(/^bk:(\d+)$/, async (ctx) => {
    const o = await store.getOrder(Number(ctx.match[1]));
    await ctx.answerCallbackQuery();
    if (o) await ctx.editMessageReplyMarkup({ reply_markup: orderCardKeyboard(o) }).catch(() => undefined);
  });

  // "Boshqa sabab" matni.
  c.on("message:text", async (ctx, next) => {
    const p = isAdmin(ctx.from.id) ? pendingReason.get(ctx.from.id) : undefined;
    if (!p || ctx.message.text.startsWith("/")) return next();
    pendingReason.delete(ctx.from.id);
    try {
      const r = await changeStatus(p.orderId, p.status, ctx.from.id, ctx.message.text.slice(0, 300));
      await ctx.reply(r.error ?? `${ADMIN_STATUS[p.status]} — #${r.order.number}`);
    } catch (e) {
      await ctx.reply(`⚠️ ${(e as Error).message}`);
    }
  });

  return c;
}

/** Zaxira: admin bot tokeni yo'q bo'lsa, kartalar mijoz boti orqali keladi — tugmalar shu yerda ishlaydi. */
export function adminFallbackComposer() {
  return callbackHandlers();
}

export function createAdminBot(): Bot | null {
  if (!config.adminBotToken) return null;
  const bot = new Bot(config.adminBotToken);

  // Ruxsat: faqat ADMIN_IDS. Boshqalarga ID'sini ko'rsatamiz (sozlash oson bo'lsin).
  bot.use(async (ctx, next) => {
    if (isAdmin(ctx.from?.id)) return next();
    if (ctx.callbackQuery) return ctx.answerCallbackQuery({ text: "Ruxsat yo‘q", show_alert: true });
    if (ctx.chat?.type === "private") {
      await ctx.reply(
        `⛔ Bu MELLA admin boti.\n\nSizning Telegram ID: <code>${ctx.from?.id}</code>\nAdmin bo‘lish uchun ushbu ID'ni do‘kon egasiga yuboring (ADMIN_IDS ga qo‘shiladi).`,
        { parse_mode: "HTML" },
      );
    }
  });

  bot.use(callbackHandlers());

  bot.command("start", async (ctx) => {
    await ctx.reply(
      `👋 Salom, ${esc(ctx.from?.first_name ?? "")}! MELLA admin paneli.\n\nYangi buyurtmalar shu yerga keladi. Tugmalar orqali holatini o‘zgartiring — mijozga avtomatik xabar boradi.`,
      { parse_mode: "HTML", reply_markup: adminMenu() },
    );
  });
  bot.command("orders", (ctx) => sendCards(ctx, ACTIVE_STATUSES, "✨ Faol buyurtmalar yo‘q."));
  bot.command("new", (ctx) => sendCards(ctx, ["created"], "✨ Yangi buyurtmalar yo‘q."));
  bot.command("today", todayReport);
  bot.command("sync", syncReport);
  bot.command("billz", async (ctx) => {
    if (!config.billz.secretToken) {
      await ctx.reply("ℹ️ BILLZ_SECRET_TOKEN o‘rnatilmagan.");
      return;
    }
    const r = await billzPing();
    if (!r.ok) {
      await ctx.reply(`⚠️ BILLZ'ga ulanib bo‘lmadi:\n<code>${esc(r.error ?? "")}</code>`, { parse_mode: "HTML" });
      return;
    }
    const lines = r.shops.map((s) => `• ${esc(s.name)}\n  <code>${esc(s.id)}</code>`);
    await ctx.reply(
      `✅ BILLZ ulangan.\n\n<b>Do‘konlar</b> (BILLZ_SHOP_IDS uchun):\n${lines.join("\n") || "—"}\n\nTanlangan: ${
        config.billz.shopIds.length ? config.billz.shopIds.map((x) => `<code>${esc(x)}</code>`).join(", ") : "barchasi"
      }`,
      { parse_mode: "HTML" },
    );
  });

  bot.hears(BTN_ACTIVE, (ctx) => sendCards(ctx, ACTIVE_STATUSES, "✨ Faol buyurtmalar yo‘q."));
  bot.hears(BTN_NEW, (ctx) => sendCards(ctx, ["created"], "✨ Yangi buyurtmalar yo‘q."));
  bot.hears(BTN_TODAY, todayReport);
  bot.hears(BTN_SYNC, syncReport);

  bot.catch((err) => console.error("[admin-bot] xato:", err.error));
  return bot;
}

export async function setupAdminWebhook(bot: Bot) {
  if (!config.publicUrl) return;
  const url = `${config.publicUrl}/webhook-admin/${config.webhookSecret}`;
  await bot.api.setWebhook(url, { secret_token: config.webhookSecret });
  console.log("[admin-bot] webhook o'rnatildi:", url);
  await bot.api
    .setMyCommands([
      { command: "orders", description: "Faol buyurtmalar" },
      { command: "new", description: "Yangi buyurtmalar" },
      { command: "today", description: "Bugungi hisobot" },
      { command: "sync", description: "BILLZ katalogini yangilash" },
      { command: "billz", description: "BILLZ ulanishi va do‘konlar" },
    ])
    .catch(() => undefined);
  // Admin botda Mini App menyusi kerak emas — standart menyu.
  await bot.api.setChatMenuButton({ menu_button: { type: "commands" } }).catch(() => undefined);
}
