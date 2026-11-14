import { Composer, InlineKeyboard, Keyboard, type Context } from "grammy";
import { config } from "../config.js";
import { addAdmin, isOwner, listExtraAdmins, removeAdmin } from "../admins.js";
import { esc } from "../util.js";

/**
 * Admin botda adminlarni boshqarish (faqat egalar — ADMIN_IDS).
 *  • «👥 Adminlar» / /admins — ro'yxat, olib tashlash, qo'shish.
 *  • Qo'shish: Telegram'dagi foydalanuvchini tanlash tugmasi yoki Telegram ID yuborish.
 *  • Begona odam admin botga /start yozsa — egalarga «✅ Admin qilish» tugmali so'rov boradi.
 */

export const BTN_ADMINS = "👥 Adminlar";
const BTN_PICK = "👤 Foydalanuvchini tanlash";
const BTN_CANCEL = "↩️ Bekor qilish";
const PICK_REQUEST_ID = 7001;

/** Egasi qo'shish rejimida: ownerId → true. */
const pendingAdd = new Set<number>();
/** Kirish so'rovi spamini cheklash: userId → oxirgi so'rov vaqti. */
const lastRequest = new Map<number, number>();
/** Kirish so'rovi yuborganlar: userId → ism (egasi tasdiqlaganda ishlatiladi). */
const requesters = new Map<number, { name: string; username: string }>();

let menuFor: (ctx: Context) => Keyboard = () => new Keyboard();
/** Admin menyusini bot.ts beradi (aylanma import bo'lmasligi uchun). */
export function setMenu(fn: (ctx: Context) => Keyboard) {
  menuFor = fn;
}

function listText() {
  const owners = config.adminIds.map((id) => `• <code>${id}</code> — ega (ADMIN_IDS)`);
  const extra = listExtraAdmins().map(
    (a) => `• ${esc(a.name || "—")}${a.username ? ` @${esc(a.username)}` : ""} — <code>${a.id}</code>`,
  );
  return [
    "👥 <b>Adminlar</b>",
    "",
    ...owners,
    ...(extra.length ? extra : ["<i>Qo‘shilgan admin yo‘q</i>"]),
    "",
    "Adminlar buyurtmalarni boshqaradi va mahsulot qo‘shadi. Admin qo‘shish/o‘chirish — faqat egalar.",
  ].join("\n");
}

function listKeyboard() {
  const kb = new InlineKeyboard().text("➕ Admin qo‘shish", "ad:new").row();
  for (const a of listExtraAdmins()) kb.text(`❌ ${(a.name || String(a.id)).slice(0, 28)}`, `ad:rm:${a.id}`).row();
  return kb;
}

async function showList(ctx: Context) {
  if (!isOwner(ctx.from?.id)) {
    await ctx.reply("⛔ Adminlarni faqat do‘kon egasi (ADMIN_IDS) boshqaradi.");
    return;
  }
  await ctx.reply(listText(), { parse_mode: "HTML", reply_markup: listKeyboard() });
}

async function doAdd(ctx: Context, u: { id: number; name: string; username: string }) {
  pendingAdd.delete(ctx.from!.id);
  if (!Number.isSafeInteger(u.id) || u.id <= 0) {
    await ctx.reply("⚠️ Noto‘g‘ri Telegram ID.", { reply_markup: menuFor(ctx) });
    return;
  }
  const added = await addAdmin({ ...u, addedBy: ctx.from!.id });
  if (!added) {
    await ctx.reply("ℹ️ Bu foydalanuvchi allaqachon admin.", { reply_markup: menuFor(ctx) });
    return;
  }
  // Yangi adminga xabar. U botga hali /start yozmagan bo'lsa Telegram yetkazmaydi.
  const delivered = await ctx.api
    .sendMessage(u.id, "✅ Siz MELLA admin botiga admin qilib qo‘shildingiz. /start bosing.")
    .then(() => true)
    .catch(() => false);
  await ctx.reply(
    `✅ <b>${esc(u.name || String(u.id))}</b> admin qilindi (<code>${u.id}</code>).${
      delivered ? "" : "\n\n⚠️ Unga xabar yetmadi: u admin botni ochib /start bosishi kerak, aks holda buyurtma kartalari bormaydi."
    }`,
    { parse_mode: "HTML", reply_markup: menuFor(ctx) },
  );
}

/**
 * Admin bo'lmagan foydalanuvchi /start yozganda: unga ID'sini ko'rsatadi va egalarga
 * «Admin qilish» tugmali so'rov yuboradi (har foydalanuvchidan soatiga ko'pi bilan bitta).
 */
export async function requestAccess(ctx: Context) {
  const u = ctx.from!;
  await ctx.reply(
    `⛔ Bu MELLA admin boti.\n\nSizning Telegram ID: <code>${u.id}</code>\nSo‘rovingiz do‘kon egasiga yuborildi — tasdiqlasa, sizga xabar keladi.`,
    { parse_mode: "HTML" },
  );
  const last = lastRequest.get(u.id) ?? 0;
  if (Date.now() - last < 3600_000) return;
  lastRequest.set(u.id, Date.now());
  if (lastRequest.size > 1000) lastRequest.clear();
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
  requesters.set(u.id, { name, username: u.username ?? "" });
  if (requesters.size > 1000) requesters.clear();
  const kb = new InlineKeyboard().text("✅ Admin qilish", `ad:ok:${u.id}`).text("✖️ Rad etish", "ad:no");
  for (const ownerId of config.adminIds) {
    await ctx.api
      .sendMessage(
        ownerId,
        `🙋 <b>Admin bo‘lish so‘rovi</b>\n${esc(name)}${u.username ? ` @${esc(u.username)}` : ""}\nID: <code>${u.id}</code>`,
        { parse_mode: "HTML", reply_markup: kb },
      )
      .catch(() => undefined);
  }
}

export function teamComposer() {
  const c = new Composer<Context>();

  c.command("admins", showList);
  c.hears(BTN_ADMINS, showList);

  // Quyidagi tugmalar — faqat egalar uchun.
  c.callbackQuery(/^ad:/, async (ctx, next) => {
    if (!isOwner(ctx.from.id)) return void (await ctx.answerCallbackQuery({ text: "Faqat do‘kon egasi", show_alert: true }));
    await next();
  });

  c.callbackQuery("ad:new", async (ctx) => {
    pendingAdd.add(ctx.from.id);
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `Yangi adminni tanlang (pastdagi «${BTN_PICK}» tugmasi) yoki uning Telegram ID raqamini yuboring.\n\nID’ni bilish oson: u admin botga /start yozsa, bot ID’sini ko‘rsatadi va sizga so‘rov keladi.`,
      {
        reply_markup: new Keyboard()
          .requestUsers(BTN_PICK, PICK_REQUEST_ID, { user_is_bot: false, max_quantity: 1, request_name: true, request_username: true })
          .row()
          .text(BTN_CANCEL)
          .resized()
          .oneTime(),
      },
    );
  });

  c.callbackQuery(/^ad:rm:(\d+)$/, async (ctx) => {
    const id = Number(ctx.match[1]);
    const ok = await removeAdmin(id);
    await ctx.answerCallbackQuery({ text: ok ? "Olib tashlandi" : "Topilmadi" });
    if (ok) await ctx.api.sendMessage(id, "ℹ️ Sizning MELLA admin huquqingiz olib tashlandi.").catch(() => undefined);
    await ctx.editMessageText(listText(), { parse_mode: "HTML", reply_markup: listKeyboard() }).catch(() => undefined);
  });

  c.callbackQuery(/^ad:ok:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
    const id = Number(ctx.match[1]);
    const r = requesters.get(id) ?? { name: "", username: "" };
    requesters.delete(id);
    await doAdd(ctx, { id, ...r });
  });

  c.callbackQuery("ad:no", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Rad etildi" });
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
  });

  c.on("message:users_shared", async (ctx, next) => {
    if (ctx.message.users_shared.request_id !== PICK_REQUEST_ID || !isOwner(ctx.from.id)) return next();
    const u = ctx.message.users_shared.users[0];
    if (!u) return;
    await doAdd(ctx, {
      id: u.user_id,
      name: [u.first_name, u.last_name].filter(Boolean).join(" "),
      username: u.username ?? "",
    });
  });

  // Qo'shish rejimida matn: ID yoki bekor qilish. Boshqa holatda — keyingi handlerlarga.
  c.on("message:text", async (ctx, next) => {
    if (!pendingAdd.has(ctx.from.id)) return next();
    const t = ctx.message.text.trim();
    if (t === BTN_CANCEL || t.startsWith("/")) {
      pendingAdd.delete(ctx.from.id);
      if (t === BTN_CANCEL) return void (await ctx.reply("Bekor qilindi.", { reply_markup: menuFor(ctx) }));
      return next();
    }
    if (!/^\d{4,15}$/.test(t)) {
      await ctx.reply(`Telegram ID faqat raqamlardan iborat. Qayta yuboring yoki «${BTN_CANCEL}».`);
      return;
    }
    await doAdd(ctx, { id: Number(t), name: "", username: "" });
  });

  return c;
}
