/** Bot sozlamalari — barchasi env orqali (kodda maxfiy ma'lumot yo'q). */

const str = (v: string | undefined, d = "") => (v ?? d).trim();
const num = (v: string | undefined, d: number) => {
  const n = Number(String(v ?? "").replace(/\s/g, ""));
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : d;
};
const bool = (v: string | undefined, d = false) => {
  const s = str(v).toLowerCase();
  if (!s) return d;
  return ["1", "true", "yes", "on"].includes(s);
};
const list = (v: string | undefined) =>
  str(v)
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);

export const config = {
  // ── Telegram ──────────────────────────────────────────────
  // Mijoz (sotuv) bot tokeni. Bo'sh bo'lsa bot ishga tushmaydi,
  // faqat Mini App va /health xizmat qiladi.
  botToken: str(process.env.BOT_CUSTOMER_TOKEN || process.env.BOT_TOKEN),
  // Admin bot tokeni — buyurtmalarni qabul qilish / holatini boshqarish.
  adminBotToken: str(process.env.BOT_ADMIN_TOKEN),
  // Admin Telegram ID'lari (vergul bilan). Faqat shular admin botdan foydalanadi.
  adminIds: list(process.env.ADMIN_IDS).map(Number).filter((n) => Number.isFinite(n) && n > 0),

  // Ommaviy domen (Railway avtomatik beradi). Webhook shu asosda o'rnatiladi.
  publicUrl: (
    process.env.PUBLIC_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "")
  )
    .trim()
    .replace(/\/+$/, ""),

  // Webhook maxfiy tokeni (Telegram har so'rovda header'da yuboradi).
  webhookSecret: str(process.env.WEBHOOK_SECRET, "mella-webhook"),

  // Brend sayti havolasi (profil sahifasida ko'rsatiladi).
  siteUrl: str(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL).replace(/\/+$/, ""),

  // initData amal qilish muddati (soniya). 0 — tekshirilmaydi.
  initDataMaxAge: num(process.env.INITDATA_MAX_AGE, 24 * 3600),

  // ── Baza (o'zimizning PostgreSQL) ─────────────────────────
  // Bo'sh bo'lsa — xotirada ishlaydi (faqat lokal sinov uchun!).
  databaseUrl: str(process.env.DATABASE_URL),

  // ── BILLZ 2.0 (ERP) ───────────────────────────────────────
  billz: {
    apiUrl: str(process.env.BILLZ_API_URL, "https://api-admin.billz.ai").replace(/\/+$/, ""),
    // BILLZ → Настройки компании → Ключи интеграции
    secretToken: str(process.env.BILLZ_SECRET_TOKEN),
    // Qaysi do'kon(lar)ning narxi va qoldig'i ko'rsatiladi (vergul bilan).
    // Bo'sh bo'lsa — barcha do'konlar qoldig'i yig'iladi, narx birinchi do'kondan.
    shopIds: list(process.env.BILLZ_SHOP_IDS || process.env.BILLZ_SHOP_ID),
    // Katalogni to'liq yangilash oralig'i (daqiqa). BILLZ tavsiyasi: >= 5.
    syncMinutes: Math.max(5, num(process.env.BILLZ_SYNC_MINUTES, 10)),
    // Faqat qoldig'i bor mahsulotlarni ko'rsatish.
    hideOutOfStock: bool(process.env.BILLZ_HIDE_OUT_OF_STOCK, false),
    // Yetkazilgan buyurtmani BILLZ'ga sotuv sifatida o'tkazish (qoldiq kamayadi).
    pushSales: bool(process.env.BILLZ_PUSH_SALES, false),
    saleShopId: str(process.env.BILLZ_SALE_SHOP_ID),
    cashboxId: str(process.env.BILLZ_CASHBOX_ID),
    paymentTypeCash: str(process.env.BILLZ_PAYMENT_TYPE_CASH),
    paymentTypeClick: str(process.env.BILLZ_PAYMENT_TYPE_CLICK),
  },

  // ── Do'kon / yetkazib berish ──────────────────────────────
  shop: {
    name: str(process.env.SHOP_NAME, "MELLA"),
    currency: str(process.env.SHOP_CURRENCY, "so‘m"),
    phone: str(process.env.SHOP_PHONE || process.env.NEXT_PUBLIC_PHONE),
    adminContact: str(process.env.SHOP_ADMIN_CONTACT).replace(/^@/, ""),
    instagram: str(process.env.SHOP_INSTAGRAM || process.env.NEXT_PUBLIC_INSTAGRAM_URL),
    address: str(process.env.SHOP_ADDRESS || process.env.NEXT_PUBLIC_ADDRESS_UZ),
    lat: num(process.env.SHOP_LAT, 0),
    lng: num(process.env.SHOP_LNG, 0),
    workingHours: str(process.env.SHOP_HOURS || process.env.NEXT_PUBLIC_HOURS),
    deliveryFee: num(process.env.DELIVERY_FEE, 0),
    freeDeliveryFrom: num(process.env.FREE_DELIVERY_FROM, 0),
    expressDeliveryFee: num(process.env.EXPRESS_DELIVERY_FEE, 0),
    minOrderAmount: num(process.env.MIN_ORDER_AMOUNT, 0),
    allowPickup: bool(process.env.ALLOW_PICKUP, true),
    // Click integratsiyasi keyingi bosqichda — hozircha "tez kunda" ko'rinadi.
    clickEnabled: bool(process.env.CLICK_ENABLED, false),
  },

  yandexMapsKey: str(process.env.YANDEX_MAPS_API_KEY),

  port: Number(process.env.PORT || 3001),
  host: "0.0.0.0",
};

export const hasBot = Boolean(config.botToken);
export const hasAdminBot = Boolean(config.adminBotToken);
export const hasBillz = Boolean(config.billz.secretToken);
