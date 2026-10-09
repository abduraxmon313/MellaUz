import { config } from "./config.js";
import { findVariant, loc, publicImage } from "./catalog/index.js";
import { store, type Lang, type Order, type OrderItem, type OrderStatus } from "./store.js";
import { isValidPhone, normPhone } from "./util.js";
import { notifyCustomerStatus, notifyNewOrder, refreshAdminCards } from "./notify.js";
import { pushSaleToBillz } from "./billz/sale.js";
import { nextStatuses } from "./status.js";

/**
 * Buyurtma xizmati. Narx, qoldiq va yetkazish haqi HAR DOIM serverda
 * (katalog snapshot'idan) hisoblanadi — Mini App yuborgan summaga ishonilmaydi.
 */

export class OrderError extends Error {
  statusCode = 400;
}

const ERR = {
  empty: { uz: "Savat bo‘sh.", ru: "Корзина пуста.", en: "Your bag is empty." },
  too_many: { uz: "Savatda juda ko‘p mahsulot.", ru: "Слишком много товаров в корзине.", en: "Too many items in the bag." },
  bad_qty: { uz: "Noto‘g‘ri miqdor.", ru: "Неверное количество.", en: "Invalid quantity." },
  gone: {
    uz: "Savatdagi ba’zi mahsulotlar endi mavjud emas. Savatni yangilang.",
    ru: "Некоторых товаров из корзины больше нет. Обновите корзину.",
    en: "Some items in your bag are no longer available. Please refresh your bag.",
  },
  low: { uz: "«{name}» — omborda faqat {n} dona qoldi.", ru: "«{name}» — на складе осталось только {n} шт.", en: "“{name}” — only {n} left in stock." },
  sold_out: { uz: "«{name}» tugagan.", ru: "«{name}» закончился.", en: "“{name}” is sold out." },
  min: { uz: "Minimal buyurtma summasiga yetmadi.", ru: "Сумма меньше минимального заказа.", en: "Below the minimum order amount." },
  address: { uz: "Yetkazib berish manzilini kiriting.", ru: "Укажите адрес доставки.", en: "Please enter a delivery address." },
  payment: { uz: "Bu to‘lov usuli hozircha mavjud emas.", ru: "Этот способ оплаты пока недоступен.", en: "This payment method isn’t available yet." },
  phone: { uz: "Telefon raqamingizni kiriting.", ru: "Укажите номер телефона.", en: "Please enter your phone number." },
} as const;

function err(lang: Lang, key: keyof typeof ERR, vars: Record<string, string | number> = {}) {
  let s: string = ERR[key][lang] ?? ERR[key].uz;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return new OrderError(s);
}

export interface OrderInput {
  items: { variant_id: string; qty: number }[];
  delivery_type?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  express?: boolean;
  note?: string;
  payment_method?: string;
  phone?: string;
  name?: string;
}

export function deliveryFeeFor(itemsTotal: number, deliveryType: string, express: boolean) {
  if (deliveryType !== "delivery") return 0;
  const s = config.shop;
  let fee = s.deliveryFee;
  if (s.freeDeliveryFrom > 0 && itemsTotal >= s.freeDeliveryFrom) fee = 0;
  if (express) fee += s.expressDeliveryFee;
  return fee;
}

export async function createOrder(
  tg: { id: number; first_name?: string; last_name?: string; username?: string },
  input: OrderInput,
  lang: Lang,
): Promise<Order> {
  if (!Array.isArray(input.items) || input.items.length === 0) throw err(lang, "empty");
  if (input.items.length > 50) throw err(lang, "too_many");

  // Bir xil variantlarni birlashtiramiz.
  const merged = new Map<string, number>();
  for (const it of input.items) {
    const qty = Math.floor(Number(it?.qty));
    if (!it?.variant_id || !Number.isFinite(qty) || qty < 1 || qty > 99) throw err(lang, "bad_qty");
    merged.set(String(it.variant_id), (merged.get(String(it.variant_id)) ?? 0) + qty);
  }

  const items: OrderItem[] = [];
  for (const [variantId, qty] of merged) {
    const found = findVariant(variantId);
    if (!found) throw err(lang, "gone");
    const { product, variant } = found;
    const name = loc(product.name, lang);
    const title = variant.label ? `${name} (${variant.label})` : name;
    if (variant.stock < qty) {
      throw variant.stock > 0 ? err(lang, "low", { name: title, n: variant.stock }) : err(lang, "sold_out", { name: title });
    }
    items.push({
      productId: product.id,
      variantId: variant.id,
      name,
      variantLabel: variant.label,
      sku: variant.sku,
      price: variant.price,
      qty,
      lineTotal: variant.price * qty,
      image: publicImage(product.images[0]),
    });
  }

  const itemsTotal = items.reduce((s, x) => s + x.lineTotal, 0);
  if (config.shop.minOrderAmount > 0 && itemsTotal < config.shop.minOrderAmount) {
    throw err(lang, "min");
  }

  const deliveryType = input.delivery_type === "pickup" && config.shop.allowPickup ? "pickup" : "delivery";
  const address = String(input.address ?? "").trim().slice(0, 600);
  if (deliveryType === "delivery" && !address) throw err(lang, "address");
  const lat = Number.isFinite(Number(input.lat)) && input.lat !== null ? Number(input.lat) : null;
  const lng = Number.isFinite(Number(input.lng)) && input.lng !== null ? Number(input.lng) : null;
  const express = deliveryType === "delivery" && Boolean(input.express);

  const method = String(input.payment_method ?? "cash").toLowerCase();
  if (method !== "cash" && !(method === "click" && config.shop.clickEnabled)) {
    throw err(lang, "payment");
  }

  const user = await store.getUser(tg.id);
  const phone = normPhone(String(input.phone ?? "").trim() || user?.phone || "");
  if (!isValidPhone(phone)) throw err(lang, "phone");
  const customerName =
    String(input.name ?? "").trim().slice(0, 80) ||
    [tg.first_name, tg.last_name].filter(Boolean).join(" ") ||
    "Mijoz";

  await store.upsertUser({
    telegramId: tg.id,
    firstName: tg.first_name ?? user?.firstName ?? "",
    lastName: tg.last_name ?? user?.lastName ?? "",
    username: tg.username ?? user?.username ?? "",
    phone,
  });

  const deliveryFee = deliveryFeeFor(itemsTotal, deliveryType, express);
  const order = await store.createOrder({
    userId: tg.id,
    customerName,
    username: tg.username ?? "",
    phone,
    items,
    itemsTotal,
    deliveryFee,
    grandTotal: itemsTotal + deliveryFee,
    deliveryType,
    address: deliveryType === "delivery" ? address : "",
    lat: deliveryType === "delivery" ? lat : null,
    lng: deliveryType === "delivery" ? lng : null,
    deliveryTime: deliveryType === "delivery" ? (express ? "express" : "day") : "",
    express,
    note: String(input.note ?? "").trim().slice(0, 600),
    paymentMethod: method === "click" ? "click" : "cash",
    lang,
  });

  // Bildirishnomalar buyurtmani to'xtatmasligi kerak.
  notifyNewOrder(order).catch((e) => console.error("[orders] admin xabari:", e));
  return order;
}

export async function changeStatus(
  orderId: number,
  to: OrderStatus,
  actorId: number | null,
  reason = "",
): Promise<{ order: Order; changed: boolean; error?: string }> {
  const cur = await store.getOrder(orderId);
  if (!cur) throw new OrderError("Buyurtma topilmadi.");
  if (cur.status === to) return { order: cur, changed: false };
  if (!nextStatuses(cur).includes(to)) {
    return { order: cur, changed: false, error: "Bu holatga o‘tkazib bo‘lmaydi (allaqachon o‘zgartirilgan)." };
  }
  const now = new Date().toISOString();
  const patch: Partial<Order> = {
    status: to,
    history: [...cur.history, { status: to, at: now, by: actorId, note: reason || undefined }],
  };
  if (to === "canceled" || to === "rejected") patch.cancelReason = reason;
  if (to === "delivered" && cur.paymentMethod === "cash") patch.isPaid = true;
  const order = (await store.updateOrder(orderId, patch))!;

  notifyCustomerStatus(order).catch((e) => console.error("[orders] mijozga xabar:", e));
  await refreshAdminCards(order).catch((e) => console.error("[orders] kartalarni yangilash:", e));

  if (to === "delivered" && config.billz.pushSales) {
    // BILLZ'ga sotuv sifatida o'tkazish (qoldiq kamayadi) — fonda.
    void pushSaleToBillz(order)
      .then(async (res) => {
        const updated = await store.updateOrder(order.id, {
          billzOrderId: res.id ?? "",
          billzDone: !res.error,
          billzError: res.error ?? "",
        });
        if (updated) await refreshAdminCards(updated);
      })
      .catch((e) => console.error("[orders] BILLZ sotuv:", e));
  }
  return { order, changed: true };
}

export function serializeOrder(o: Order) {
  return {
    id: o.id,
    order_number: o.number,
    status: o.status,
    items: o.items.map((it) => ({
      name: it.name,
      variant: it.variantLabel,
      qty: it.qty,
      price: it.price,
      line_total: it.lineTotal,
      image: it.image,
    })),
    items_total: o.itemsTotal,
    delivery_fee: o.deliveryFee,
    grand_total: o.grandTotal,
    delivery_type: o.deliveryType,
    address: o.address,
    delivery_time: o.deliveryTime,
    note: o.note,
    phone: o.phone,
    payment_method: o.paymentMethod,
    is_paid: o.isPaid,
    cancel_reason: o.cancelReason,
    created_at: o.createdAt,
  };
}
