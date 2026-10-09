import { config } from "./config.js";
import { bots } from "./telegram.js";
import { store, type Order } from "./store.js";
import { statusText, t } from "./i18n.js";
import { esc, money } from "./util.js";
import { orderCardKeyboard, orderCardText } from "./admin/card.js";

/** Kartalar qaysi bot orqali yuboriladi: admin bot, bo'lmasa mijoz boti (zaxira). */
function staffBot() {
  return bots.admin ?? bots.customer;
}

export async function notifyNewOrder(order: Order) {
  // 1) Mijozga chek-xabar (mijoz boti orqali).
  if (bots.customer) {
    const items = order.items
      .map((it) => `• ${esc(it.name)}${it.variantLabel ? ` (${esc(it.variantLabel)})` : ""} × ${it.qty} — ${money(it.lineTotal)}`)
      .join("\n");
    const payment = order.paymentMethod === "click" ? t("pay_click", order.lang) : t("pay_cash", order.lang);
    await bots.customer.api
      .sendMessage(
        order.userId,
        t("order_received", order.lang, { number: order.number, items, total: money(order.grandTotal), payment }),
        { parse_mode: "HTML" },
      )
      .catch((e) => console.warn("[notify] mijozga chek yuborilmadi:", e.description ?? e.message));
  }

  // 2) Adminlarga karta.
  const bot = staffBot();
  if (!bot) return;
  if (!config.adminIds.length) {
    console.warn("[notify] ADMIN_IDS bo'sh — yangi buyurtma hech kimga yuborilmadi!");
    return;
  }
  const text = orderCardText(order);
  const kb = orderCardKeyboard(order);
  await Promise.all(
    config.adminIds.map(async (chatId) => {
      try {
        const m = await bot.api.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: kb });
        await store.addAdminCard({ orderId: order.id, chatId, messageId: m.message_id });
      } catch (e) {
        const err = e as { description?: string; message?: string };
        console.warn(`[notify] admin ${chatId} ga yuborilmadi (botni /start qilganmi?):`, err.description ?? err.message);
      }
    }),
  );
}

export async function refreshAdminCards(order: Order) {
  const bot = staffBot();
  if (!bot) return;
  const cards = await store.getAdminCards(order.id);
  const text = orderCardText(order);
  const kb = orderCardKeyboard(order);
  await Promise.all(
    cards.map((c) =>
      bot.api
        .editMessageText(c.chatId, c.messageId, text, { parse_mode: "HTML", reply_markup: kb })
        .catch((e) => {
          if (!String(e.description ?? "").includes("not modified")) {
            console.warn("[notify] kartani yangilab bo'lmadi:", e.description ?? e.message);
          }
        }),
    ),
  );
}

export async function notifyCustomerStatus(order: Order) {
  if (!bots.customer) return;
  let text = t("status_changed", order.lang, { number: order.number, status: statusText(order.status, order.lang) });
  if (order.cancelReason && (order.status === "canceled" || order.status === "rejected")) {
    text += "\n" + t("cancel_reason", order.lang, { reason: esc(order.cancelReason) });
  }
  await bots.customer.api
    .sendMessage(order.userId, text, { parse_mode: "HTML" })
    .catch((e) => console.warn("[notify] mijozga holat yuborilmadi:", e.description ?? e.message));
}
