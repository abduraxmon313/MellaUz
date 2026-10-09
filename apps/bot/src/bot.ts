import { Bot, Composer, InlineKeyboard, Keyboard, type Context } from "grammy";
import { config } from "./config.js";
import { store, type Lang } from "./store.js";
import { normLang, statusText, t, type TKey } from "./i18n.js";
import { esc, money, normPhone } from "./util.js";

/**
 * Mijoz (sotuv) boti — Gunesh tuzilishida:
 *  /start → til tanlash → telefon raqam → asosiy menyu.
 *  Mini App ☰ menyu tugmasi va inline `web_app` tugma orqali ochiladi
 *  (reply-keyboard'dagi web_app tugmasi ba'zi klientlarda initData bermaydi).
 *  Buyurtma holati xabarlari shu bot orqali keladi (notify.ts).
 */

const LANGS: [Lang, string][] = [
  ["uz", "🇺🇿 O‘zbekcha"],
  ["ru", "🇷🇺 Русский"],
  ["en", "🇬🇧 English"],
];

const miniAppUrl = () => config.publicUrl || "";

function langKeyboard() {
  const kb = new InlineKeyboard();
  for (const [code, label] of LANGS) kb.text(label, `lang:${code}`);
  return kb;
}

function mainMenu(lang: Lang) {
  return new Keyboard()
    .text(t("btn_shop", lang))
    .row()
    .text(t("btn_orders", lang))
    .text(t("btn_contact", lang))
    .row()
    .text(t("btn_lang", lang))
    .resized()
    .persistent();
}

function phoneKeyboard(lang: Lang) {
  return new Keyboard().requestContact(t("share_phone_btn", lang)).resized().oneTime();
}

function shopInline(lang: Lang) {
  const url = miniAppUrl();
  return url ? new InlineKeyboard().webApp(t("btn_shop", lang), url) : undefined;
}

/** Tugma matni istalgan tilda bo'lsa ham taniladi. */
function isButton(text: string | undefined, key: TKey) {
  if (!text) return false;
  return (["uz", "ru", "en"] as Lang[]).some((l) => t(key, l) === text);
}

async function userLang(ctx: Context): Promise<Lang> {
  const u = ctx.from ? await store.getUser(ctx.from.id) : null;
  return (u?.lang || normLang(ctx.from?.language_code)) as Lang;
}

async function sendWelcome(ctx: Context, lang: Lang) {
  const u = await store.getUser(ctx.from!.id);
  const name = esc(ctx.from?.first_name || "");
  await ctx.reply(t("welcome", lang, { name }), {
    parse_mode: "HTML",
    reply_markup: shopInline(lang),
  });
  if (!u?.phone) {
    await ctx.reply(t("ask_phone", lang), { reply_markup: phoneKeyboard(lang) });
  } else {
    await ctx.reply("👇", { reply_markup: mainMenu(lang) });
  }
}

export function createBot(extra?: Composer<Context>): Bot | null {
  if (!config.botToken) return null;
  const bot = new Bot(config.botToken);

  // Har bir xabarda mijoz ma'lumotini yangilab boramiz (ism/username o'zgarishi mumkin).
  bot.use(async (ctx, next) => {
    if (ctx.from && ctx.chat?.type === "private") {
      await store
        .upsertUser({
          telegramId: ctx.from.id,
          firstName: ctx.from.first_name ?? "",
          lastName: ctx.from.last_name ?? "",
          username: ctx.from.username ?? "",
        })
        .catch((e) => console.warn("[bot] user upsert:", e.message));
    }
    await next();
  });

  // Zaxira rejim: admin bot yo'q bo'lsa, buyurtma kartasi tugmalari shu botda ishlaydi.
  if (extra) bot.use(extra);

  bot.command("start", async (ctx) => {
    const u = await store.getUser(ctx.from!.id);
    if (!u?.lang) {
      await ctx.reply(t("choose_lang", normLang(ctx.from?.language_code)), { reply_markup: langKeyboard() });
      return;
    }
    await sendWelcome(ctx, u.lang as Lang);
  });

  bot.command("lang", async (ctx) => {
    await ctx.reply(t("choose_lang", await userLang(ctx)), { reply_markup: langKeyboard() });
  });

  bot.callbackQuery(/^lang:(uz|ru|en)$/, async (ctx) => {
    const lang = ctx.match[1] as Lang;
    const prev = await store.getUser(ctx.from.id);
    await store.upsertUser({ telegramId: ctx.from.id, lang });
    await ctx.answerCallbackQuery({ text: t("lang_saved", lang) });
    await ctx.deleteMessage().catch(() => undefined);
    if (!prev?.lang) await sendWelcome(ctx, lang);
    else await ctx.reply(t("lang_saved", lang), { reply_markup: mainMenu(lang) });
  });

  // Telefon raqam (bot tugmasi yoki Mini App'dagi requestContact orqali keladi).
  bot.on("message:contact", async (ctx) => {
    const lang = await userLang(ctx);
    const c = ctx.message.contact;
    if (c.user_id && c.user_id !== ctx.from.id) {
      await ctx.reply(t("phone_not_own", lang), { reply_markup: phoneKeyboard(lang) });
      return;
    }
    await store.upsertUser({ telegramId: ctx.from.id, phone: normPhone(c.phone_number) });
    await ctx.reply(t("phone_saved", lang), { reply_markup: mainMenu(lang) });
    const kb = shopInline(lang);
    if (kb) await ctx.reply(t("open_shop_text", lang), { reply_markup: kb });
  });

  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text;
    const lang = await userLang(ctx);

    if (isButton(text, "btn_shop")) {
      const kb = shopInline(lang);
      await ctx.reply(t("open_shop_text", lang), kb ? { reply_markup: kb } : {});
      return;
    }

    if (isButton(text, "btn_orders")) {
      const orders = await store.listOrdersByUser(ctx.from.id, 5);
      if (!orders.length) {
        await ctx.reply(t("no_orders", lang), { reply_markup: shopInline(lang) });
        return;
      }
      const lines = orders.map(
        (o) => `<b>#${o.number}</b> · ${statusText(o.status, lang)}\n${o.items.length} × · ${money(o.grandTotal)}`,
      );
      await ctx.reply(`${t("my_orders_title", lang)}\n\n${lines.join("\n\n")}`, {
        parse_mode: "HTML",
        reply_markup: shopInline(lang),
      });
      return;
    }

    if (isButton(text, "btn_contact")) {
      const s = config.shop;
      const rows = [t("contacts_title", lang), ""];
      if (s.phone) rows.push(`📞 ${esc(s.phone)}`);
      if (s.address) rows.push(`📍 ${esc(s.address)}`);
      if (s.workingHours) rows.push(`🕙 ${esc(s.workingHours)}`);
      if (s.adminContact) rows.push(`💬 @${esc(s.adminContact)}`);
      if (s.instagram) rows.push(`📸 ${esc(s.instagram)}`);
      if (config.siteUrl) rows.push(`🌐 ${esc(config.siteUrl)}`);
      const kb = new InlineKeyboard();
      if (s.lat && s.lng) kb.url("🗺 Yandex Maps", `https://yandex.uz/maps/?pt=${s.lng},${s.lat}&z=17&l=map`);
      await ctx.reply(rows.join("\n"), { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    if (isButton(text, "btn_lang")) {
      await ctx.reply(t("choose_lang", lang), { reply_markup: langKeyboard() });
      return;
    }

    await next();
  });

  // Tanilmagan xabar — menyuni qayta ko'rsatamiz.
  bot.on("message", async (ctx) => {
    const lang = await userLang(ctx);
    await ctx.reply(t("open_shop_text", lang), { reply_markup: shopInline(lang) ?? mainMenu(lang) });
  });

  bot.catch((err) => {
    console.error("[bot] xato:", err.error);
  });

  return bot;
}

/** Webhook va menyu tugmasini o'rnatadi (idempotent — har start'da xavfsiz). */
export async function setupWebhook(bot: Bot): Promise<void> {
  if (!config.publicUrl) {
    console.warn("[bot] PUBLIC_URL yo'q — webhook o'rnatilmadi.");
    return;
  }
  const url = `${config.publicUrl}/webhook/${config.webhookSecret}`;
  await bot.api.setWebhook(url, { secret_token: config.webhookSecret });
  console.log("[bot] webhook o'rnatildi:", url);

  try {
    await bot.api.setChatMenuButton({
      menu_button: { type: "web_app", text: "MELLA", web_app: { url: config.publicUrl } },
    });
  } catch (err) {
    console.warn("[bot] menyu tugmasini o'rnatib bo'lmadi:", err);
  }
  await bot.api
    .setMyCommands([
      { command: "start", description: "MELLA do‘koni" },
      { command: "lang", description: "Til / Язык / Language" },
    ])
    .catch(() => undefined);
}
