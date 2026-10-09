/**
 * BILLZ integratsiyasining jarayon ichidagi tutun-testi (soxta BILLZ server bilan):
 *   BILLZ_API_URL=http://127.0.0.1:4555 BILLZ_SECRET_TOKEN=test-secret … tsx scripts/billz-smoke.ts
 */
import assert from "node:assert/strict";
import { getProductDetail, initCatalog, listCategories, listProducts, syncNow, catalogStatus } from "../src/catalog/index.js";
import { createOrder, OrderError } from "../src/orders.js";
import { changeStatus } from "../src/orders.js";
import { store } from "../src/store.js";

await store.init();
await initCatalog();
await syncNow();
const st = catalogStatus();
console.log("catalog:", st);
assert.equal(st.source, "billz");
assert.equal(st.lastError, "");

const cats = listCategories("ru");
console.log("categories:", cats);
assert.deepEqual(cats.map((c) => c.name), ["Обувь", "Сумки"], "subkategoriya ildizga ko'tarilishi kerak");

const list = listProducts({ sort: "popular" }, "uz");
console.log("products:", list.map((p) => [p.id, p.price, p.old_price, p.stock, p.has_variants, p.image]));
assert.equal(list.length, 2, "narxsiz va xizmat yashirilishi kerak");

const heel = getProductDetail("P-HEEL", "uz")!;
console.log("heel:", heel.variants, heel.images, heel.attribute_name);
assert.deepEqual(heel.variants.map((v) => v.label), ["36", "38", "40"], "o'lchamlar tartiblangan");
assert.equal(heel.price, 712000, "aksiya narxi (promos to'ldirilgan)");
assert.equal(heel.old_price, 890000);
assert.equal(heel.variants.find((v) => v.label === "38")!.stock, 2, "faqat tanlangan do'kon qoldig'i");
assert.equal(heel.images.length, 2);
assert.ok(heel.images[0]!.startsWith("/img/"), "rasm o'z serverimiz orqali");
assert.equal(heel.attribute_name, "Размер");

// Qoldiqdan ortiq — xato
await assert.rejects(
  createOrder({ id: 42, first_name: "Ali" }, { items: [{ variant_id: "V-HEEL-38", qty: 3 }], delivery_type: "pickup", phone: "901112233" }, "uz"),
  (e: unknown) => e instanceof OrderError && /2 dona/.test((e as Error).message),
);

const order = await createOrder(
  { id: 42, first_name: "Ali", last_name: "Valiyev" },
  { items: [{ variant_id: "V-HEEL-38", qty: 1 }], delivery_type: "pickup", phone: "+998 90 111 22 33" },
  "uz",
);
console.log("order:", order.number, order.itemsTotal, order.items);
assert.equal(order.itemsTotal, 712000);

assert.equal((await changeStatus(order.id, "delivered", 1)).changed, false, "created → delivered taqiqlangan");
await changeStatus(order.id, "confirmed", 1);
await changeStatus(order.id, "preparing", 1);
const r = await changeStatus(order.id, "on_way", 1);
assert.equal(r.changed, false, "olib ketishda 'yo'lda' yo'q");
await changeStatus(order.id, "delivered", 1);

// BILLZ sotuvi fonda o'tadi.
for (let i = 0; i < 40; i++) {
  const o = await store.getOrder(order.id);
  if (o?.billzDone || o?.billzError) break;
  await new Promise((r) => setTimeout(r, 250));
}
const fin = (await store.getOrder(order.id))!;
console.log("final:", fin.status, fin.isPaid, fin.billzOrderId, fin.billzError, fin.history.map((h) => h.status));
assert.equal(fin.billzOrderId, "SALE-1");
assert.equal(fin.billzError, "");
assert.equal(fin.billzDone, true);

const calls = (await (await fetch("http://127.0.0.1:4555/_calls")).json()) as string[];
console.log(calls.join("\n"));
console.log("\n✅ BILLZ smoke test o'tdi");
process.exit(0);
