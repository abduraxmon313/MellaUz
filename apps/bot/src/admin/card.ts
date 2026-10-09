import { InlineKeyboard } from "grammy";
import { config } from "../config.js";
import type { Order, OrderStatus } from "../store.js";
import { nextStatuses } from "../status.js";
import { esc, money, tashkentDate, yandexMapUrl } from "../util.js";

/** Admin uchun holat nomlari va tugma yozuvlari (admin interfeysi o'zbekcha). */
export const ADMIN_STATUS: Record<OrderStatus, string> = {
  created: "🆕 Yangi",
  confirmed: "✅ Tasdiqlangan",
  preparing: "🎁 Qadoqlanmoqda",
  on_way: "🚚 Yo‘lda",
  delivered: "🎉 Yetkazildi",
  canceled: "❌ Bekor qilingan",
  rejected: "⛔ Rad etilgan",
};

const ACTION_LABEL: Record<OrderStatus, string> = {
  created: "",
  confirmed: "✅ Qabul qilish",
  preparing: "🎁 Qadoqlanmoqda",
  on_way: "🚚 Yo‘lga chiqdi",
  delivered: "🎉 Yetkazildi",
  canceled: "❌ Bekor qilish",
  rejected: "⛔ Rad etish",
};

export const CANCEL_REASONS = [
  "Mahsulot tugagan",
  "Mijoz javob bermadi",
  "Mijoz bekor qildi",
  "Manzil noto‘g‘ri / yetkazib bo‘lmaydi",
];

export function orderCardText(o: Order): string {
  const lines: string[] = [];
  lines.push(`🛍 <b>Buyurtma #${o.number}</b> — ${ADMIN_STATUS[o.status]}`);
  lines.push("");
  lines.push(`👤 ${esc(o.customerName)}${o.username ? ` (@${esc(o.username)})` : ""}`);
  lines.push(`📞 <code>${esc(o.phone)}</code>`);
  if (o.deliveryType === "delivery") {
    lines.push(`🚚 Yetkazib berish${o.express ? " · ⚡ <b>tezkor</b>" : " · kun davomida"}`);
    if (o.address) lines.push(`📍 ${esc(o.address)}`);
  } else {
    lines.push(`🏬 Do‘kondan olib ketadi`);
  }
  if (o.note) lines.push(`💬 <i>${esc(o.note)}</i>`);
  lines.push("");
  for (const it of o.items) {
    const v = it.variantLabel ? ` <b>(${esc(it.variantLabel)})</b>` : "";
    lines.push(`• ${esc(it.name)}${v} × ${it.qty} = ${money(it.lineTotal)}${it.sku ? `\n   <code>${esc(it.sku)}</code>` : ""}`);
  }
  lines.push("");
  lines.push(`Mahsulotlar: ${money(o.itemsTotal)}`);
  if (o.deliveryType === "delivery") lines.push(`Yetkazish: ${o.deliveryFee ? money(o.deliveryFee) : "bepul"}`);
  lines.push(`💰 <b>Jami: ${money(o.grandTotal)}</b>`);
  lines.push(`💵 To‘lov: ${o.paymentMethod === "click" ? "Click" : "Naqd (qabul qilganda)"}${o.isPaid ? " · ✅ to‘langan" : ""}`);
  lines.push(`🗓 ${tashkentDate(o.createdAt)}`);
  if (o.cancelReason) lines.push(`\n❗ Sabab: ${esc(o.cancelReason)}`);
  if (config.billz.pushSales && o.status === "delivered") {
    if (o.billzError) lines.push(`\n⚠️ BILLZ: ${esc(o.billzError)}`);
    else if (o.billzDone) lines.push(`\n🧾 BILLZ: sotuv o‘tkazildi`);
    else lines.push(`\n⏳ BILLZ: sotuv o‘tkazilmoqda…`);
  }
  return lines.join("\n");
}

export function orderCardKeyboard(o: Order): InlineKeyboard {
  const kb = new InlineKeyboard();
  const next = nextStatuses(o);
  const forward = next.filter((s) => s !== "canceled" && s !== "rejected");
  forward.forEach((s, i) => {
    kb.text(ACTION_LABEL[s], `st:${o.id}:${s}`);
    if (i % 2 === 1) kb.row();
  });
  if (forward.length % 2 === 1) kb.row();
  for (const s of next.filter((x) => x === "canceled" || x === "rejected")) {
    kb.text(ACTION_LABEL[s], `rs:${o.id}:${s}`).row();
  }
  if (o.lat && o.lng) kb.url("🗺 Xaritada", yandexMapUrl(o.lat, o.lng));
  if (o.username) kb.url("💬 Mijozga yozish", `https://t.me/${o.username}`);
  else kb.url("💬 Mijoz profili", `tg://user?id=${o.userId}`);
  return kb;
}

export function reasonKeyboard(o: Order, status: OrderStatus): InlineKeyboard {
  const kb = new InlineKeyboard();
  CANCEL_REASONS.forEach((r, i) => kb.text(r, `cx:${o.id}:${status}:${i}`).row());
  kb.text("✍️ Boshqa sabab yozish", `cw:${o.id}:${status}`).row();
  kb.text("⬅️ Ortga", `bk:${o.id}`);
  return kb;
}
