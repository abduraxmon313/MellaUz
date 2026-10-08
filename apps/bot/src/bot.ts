import { Bot } from "grammy";
import { config } from "./config.js";

/**
 * Sotuv bot (starter).
 *
 * Hozircha: /start bosilганда Mini App tugmasi va qisqa salom chiqadi.
 * Keyingi bosqichda bu yerga buyurtma oqimi, til tanlash, status
 * bildirishnomalari qo'shiladi (Gunesh uslubida).
 */
export function createBot(): Bot | null {
  if (!config.botToken) return null;

  const bot = new Bot(config.botToken);
  const miniAppUrl = config.publicUrl || "";

  bot.command("start", async (ctx) => {
    const text =
      "Assalomu alaykum! MELLA — tabiiy charm oyoq kiyim, sumka va aksessuarlar.\n\n" +
      "Kolleksiyani ko‘rish va buyurtma berish uchun pastdagi tugmani bosing 👇";

    if (miniAppUrl) {
      await ctx.reply(text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛍 Do‘konni ochish", web_app: { url: miniAppUrl } }],
          ],
        },
      });
    } else {
      await ctx.reply(text);
    }
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
      menu_button: {
        type: "web_app",
        text: "MELLA",
        web_app: { url: config.publicUrl },
      },
    });
  } catch (err) {
    console.warn("[bot] menyu tugmasini o'rnatib bo'lmadi:", err);
  }
}
