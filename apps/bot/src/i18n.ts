import type { Lang, OrderStatus } from "./store.js";

/** Bot (server) tomonidagi matnlar — uz / ru / en. */
const T = {
  choose_lang: {
    uz: "Tilni tanlang 👇",
    ru: "Выберите язык 👇",
    en: "Choose your language 👇",
  },
  welcome: {
    uz: "Assalomu alaykum, {name}! ✨\n\n<b>MELLA</b> — tabiiy charmdan ayollar oyoq kiyimi, sumkalar, kiyim va aksessuarlar.\n\nKolleksiyani ko‘rish va buyurtma berish uchun «🛍 Do‘konni ochish» tugmasini bosing.",
    ru: "Здравствуйте, {name}! ✨\n\n<b>MELLA</b> — женская обувь, сумки, одежда и аксессуары из натуральной кожи.\n\nЧтобы посмотреть коллекцию и оформить заказ, нажмите «🛍 Открыть магазин».",
    en: "Hello, {name}! ✨\n\n<b>MELLA</b> — women’s genuine-leather footwear, bags, clothing and accessories.\n\nTap “🛍 Open shop” to browse the collection and place an order.",
  },
  ask_phone: {
    uz: "Buyurtma holati haqida xabar berishimiz uchun telefon raqamingizni yuboring 👇",
    ru: "Отправьте номер телефона, чтобы мы могли сообщать о статусе заказа 👇",
    en: "Please share your phone number so we can update you about your orders 👇",
  },
  share_phone_btn: { uz: "📱 Raqamni yuborish", ru: "📱 Отправить номер", en: "📱 Share phone" },
  phone_saved: {
    uz: "✅ Rahmat! Raqamingiz saqlandi.",
    ru: "✅ Спасибо! Номер сохранён.",
    en: "✅ Thank you! Your number is saved.",
  },
  phone_not_own: {
    uz: "Iltimos, o‘zingizning raqamingizni tugma orqali yuboring.",
    ru: "Пожалуйста, отправьте свой номер через кнопку.",
    en: "Please share your own number using the button.",
  },
  btn_shop: { uz: "🛍 Do‘konni ochish", ru: "🛍 Открыть магазин", en: "🛍 Open shop" },
  btn_orders: { uz: "📦 Buyurtmalarim", ru: "📦 Мои заказы", en: "📦 My orders" },
  btn_contact: { uz: "📞 Aloqa", ru: "📞 Контакты", en: "📞 Contacts" },
  btn_lang: { uz: "🌐 Til", ru: "🌐 Язык", en: "🌐 Language" },
  open_shop_text: {
    uz: "Kolleksiyamiz shu yerda 👇",
    ru: "Наша коллекция здесь 👇",
    en: "Our collection is right here 👇",
  },
  no_orders: {
    uz: "Sizda hali buyurtmalar yo‘q. Do‘konni ochib, birinchi xaridingizni qiling ✨",
    ru: "У вас пока нет заказов. Откройте магазин и сделайте первую покупку ✨",
    en: "You have no orders yet. Open the shop and make your first purchase ✨",
  },
  my_orders_title: { uz: "📦 <b>Oxirgi buyurtmalaringiz:</b>", ru: "📦 <b>Ваши последние заказы:</b>", en: "📦 <b>Your recent orders:</b>" },
  contacts_title: { uz: "📞 <b>MELLA bilan aloqa</b>", ru: "📞 <b>Контакты MELLA</b>", en: "📞 <b>Contact MELLA</b>" },
  lang_saved: { uz: "✅ Til o‘zgartirildi", ru: "✅ Язык изменён", en: "✅ Language changed" },

  order_received: {
    uz: "🛍 <b>Buyurtma #{number} qabul qilindi!</b>\n\n{items}\n\n💰 Jami: <b>{total}</b>\n💵 To‘lov: {payment}\n\nOperatorimiz tez orada tasdiqlaydi. Holat o‘zgarganda shu yerda xabar beramiz.",
    ru: "🛍 <b>Заказ #{number} принят!</b>\n\n{items}\n\n💰 Итого: <b>{total}</b>\n💵 Оплата: {payment}\n\nОператор скоро подтвердит заказ. Об изменениях статуса сообщим здесь.",
    en: "🛍 <b>Order #{number} received!</b>\n\n{items}\n\n💰 Total: <b>{total}</b>\n💵 Payment: {payment}\n\nOur operator will confirm it shortly. We’ll notify you here about any status change.",
  },
  status_changed: {
    uz: "📦 Buyurtma <b>#{number}</b>: {status}",
    ru: "📦 Заказ <b>#{number}</b>: {status}",
    en: "📦 Order <b>#{number}</b>: {status}",
  },
  cancel_reason: { uz: "Sabab: {reason}", ru: "Причина: {reason}", en: "Reason: {reason}" },
  pay_cash: { uz: "Naqd (qabul qilganda)", ru: "Наличными (при получении)", en: "Cash on delivery" },
  pay_click: { uz: "Click", ru: "Click", en: "Click" },
} as const;

export type TKey = keyof typeof T;

export function t(key: TKey, lang: Lang | "" | undefined, vars: Record<string, string | number> = {}) {
  const l = (lang || "uz") as Lang;
  let s: string = T[key][l] ?? T[key].uz;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Mijozga yuboriladigan holat nomlari. */
export const STATUS_TEXT: Record<OrderStatus, Record<Lang, string>> = {
  created: { uz: "🆕 Yangi", ru: "🆕 Новый", en: "🆕 New" },
  confirmed: { uz: "✅ Tasdiqlandi", ru: "✅ Подтверждён", en: "✅ Confirmed" },
  preparing: { uz: "🎁 Qadoqlanmoqda", ru: "🎁 Упаковывается", en: "🎁 Being packed" },
  on_way: { uz: "🚚 Yo‘lda", ru: "🚚 В пути", en: "🚚 On the way" },
  delivered: { uz: "🎉 Yetkazildi", ru: "🎉 Доставлен", en: "🎉 Delivered" },
  canceled: { uz: "❌ Bekor qilindi", ru: "❌ Отменён", en: "❌ Canceled" },
  rejected: { uz: "⛔ Rad etildi", ru: "⛔ Отклонён", en: "⛔ Rejected" },
};

export function statusText(s: OrderStatus, lang: Lang | "" | undefined) {
  return STATUS_TEXT[s][(lang || "uz") as Lang];
}

export function normLang(v: unknown): Lang {
  const s = String(v ?? "").slice(0, 2).toLowerCase();
  return s === "ru" || s === "en" ? s : "uz";
}
