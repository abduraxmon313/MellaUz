/** Bot sozlamalari — barchasi env orqali (kodda maxfiy ma'lumot yo'q). */
export const config = {
  // Sotuv bot tokeni (BotFather). Bo'sh bo'lsa bot ishga tushmaydi,
  // faqat Mini App va /health xizmat qiladi.
  botToken: (process.env.BOT_CUSTOMER_TOKEN || process.env.BOT_TOKEN || "").trim(),

  // Admin bot tokeni (buyurtma boshqaruvi) — ixtiyoriy, kelajak uchun.
  adminBotToken: (process.env.BOT_ADMIN_TOKEN || "").trim(),

  // Ommaviy domen (Railway avtomatik beradi). Webhook shu asosda o'rnatiladi.
  publicUrl: (
    process.env.PUBLIC_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : "")
  ).replace(/\/+$/, ""),

  // Webhook maxfiy tokeni (Telegram har so'rovda header'da yuboradi).
  webhookSecret: (process.env.WEBHOOK_SECRET || "mella-webhook").trim(),

  // Mini App ichida ko'rsatiladigan sayt havolasi (brend sayti).
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").replace(/\/+$/, ""),

  port: Number(process.env.PORT || 3001),
  host: "0.0.0.0",
};

export const hasBot = Boolean(config.botToken);
