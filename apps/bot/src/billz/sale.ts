import { config } from "../config.js";
import { store, type Order } from "../store.js";
import { billz, BillzError } from "./client.js";

/**
 * Yetkazilgan buyurtmani BILLZ'da SOTUV sifatida o'tkazish (ixtiyoriy,
 * BILLZ_PUSH_SALES=true). Shunda BILLZ qoldig'i kamayadi va sotuv hisobotlarga tushadi.
 *
 * BILLZ'da alohida "internet-buyurtma" yo'q — buyurtma odatiy sotuv bilan
 * o'tkaziladi, oraliq holatlar esa bizning bazada saqlanadi.
 * Ketma-ketlik (docs.billz.io → Интернет-заказ из внешней системы):
 *   GET/POST /v1/client → POST /v2/order → POST /v2/order-product/:id (har pozitsiya)
 *   → PUT /v2/order-customer-new/:id → POST /v1/recalculate-order-bill/:id
 *   → POST /v2/order-payment/:id
 * Asinxron metodlar `Billz-Response-Channel: HTTP` bilan chaqiriladi.
 *
 * Yetkazib berish haqi BILLZ chekiga kirmaydi (u tovar emas).
 */

interface Envelope<T = Record<string, unknown>> {
  id?: string;
  data?: T & { id?: string };
}

async function findOrCreateClient(o: Order): Promise<string | null> {
  try {
    const found = await billz<{ count?: number; clients?: { id: string }[] }>("/v1/client", {
      query: { phone_number: o.phone, limit: 1, page: 1 },
    });
    if (found.clients?.[0]?.id) return found.clients[0].id;
    const [first, ...rest] = o.customerName.split(/\s+/);
    const created = await billz<{ id?: string }>("/v1/client", {
      method: "POST",
      body: { first_name: first || "Mijoz", last_name: rest.join(" "), phone_number: o.phone },
    });
    return created.id ?? null;
  } catch (e) {
    console.warn("[billz-sale] mijoz topilmadi/yaratilmadi:", (e as Error).message);
    return null;
  }
}

export async function pushSaleToBillz(order: Order): Promise<{ id?: string; error?: string }> {
  const b = config.billz;
  const shopId = b.saleShopId || b.shopIds[0] || "";
  const paymentType = order.paymentMethod === "click" ? b.paymentTypeClick || b.paymentTypeCash : b.paymentTypeCash;
  if (!shopId || !b.cashboxId || !paymentType) {
    return { error: "BILLZ_SALE_SHOP_ID / BILLZ_CASHBOX_ID / BILLZ_PAYMENT_TYPE_CASH sozlanmagan" };
  }
  // Takroriy o'tkazishdan himoya.
  const fresh = await store.getOrder(order.id);
  if (fresh?.billzDone) return { id: fresh.billzOrderId };
  if (fresh?.billzOrderId) {
    return { id: fresh.billzOrderId, error: "Avvalgi urinish yakunlanmagan — BILLZ'da sotuvni tekshiring" };
  }

  let saleId = "";
  try {
    const created = await billz<Envelope>("/v2/order", {
      method: "POST",
      asyncHttp: true,
      body: { shop_id: shopId, cashbox_id: b.cashboxId },
    });
    saleId = created.id || created.data?.id || "";
    if (!saleId) throw new Error("BILLZ sotuv ID qaytarmadi");
    // UUID darhol saqlanadi (keyingi qadam yiqilsa ham bog'lanish yo'qolmasin).
    await store.updateOrder(order.id, { billzOrderId: saleId });

    for (const it of order.items) {
      await billz(`/v2/order-product/${saleId}`, {
        method: "POST",
        asyncHttp: true,
        body: { product_id: it.variantId, sold_measurement_value: it.qty, used_wholesale_price: false },
      });
    }

    const clientId = await findOrCreateClient(order);
    if (clientId) {
      await billz(`/v2/order-customer-new/${saleId}`, {
        method: "PUT",
        asyncHttp: true,
        body: { customer_id: clientId, check_auth_code: false },
      }).catch((e) => console.warn("[billz-sale] mijozni bog'lab bo'lmadi:", (e as Error).message));
    }

    // Mini App'da ko'rsatilgan narx bilan BILLZ narxi farq qilsa (aksiya kechikishi),
    // mijoz to'lagan summani yakuniy narx sifatida belgilaymiz.
    const bill = await billz<{ total_price?: number }>(`/v1/recalculate-order-bill/${saleId}`, { method: "POST" });
    let total = Math.round(Number(bill.total_price ?? 0));
    if (total > 0 && total !== order.itemsTotal) {
      await billz(`/v2/order-manual-discount/${saleId}`, {
        method: "POST",
        asyncHttp: true,
        body: { discount_unit: "CURRENCY", discount_value: order.itemsTotal },
      });
      const again = await billz<{ total_price?: number }>(`/v1/recalculate-order-bill/${saleId}`, { method: "POST" });
      total = Math.round(Number(again.total_price ?? order.itemsTotal));
    }
    if (!total) total = order.itemsTotal;

    await billz(`/v2/order-payment/${saleId}`, {
      method: "POST",
      body: {
        payments: [{ company_payment_type_id: paymentType, paid_amount: total, returned_amount: 0 }],
        comment: `MELLA Telegram #${order.number}`,
        without_cashback: false,
      },
    });
    console.log(`[billz-sale] #${order.number} → BILLZ sotuv ${saleId}`);
    return { id: saleId };
  } catch (e) {
    const code = e instanceof BillzError ? e.errorCode : null;
    const msg = `${(e as Error).message}${code ? ` (kod ${code})` : ""}`;
    console.error(`[billz-sale] #${order.number} xato:`, msg);
    return { id: saleId || undefined, error: msg.slice(0, 400) };
  }
}
