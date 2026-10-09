/** PostgreSQL ombori tutun-testi:  DATABASE_URL=postgres://… tsx scripts/store-smoke.ts */
import assert from "node:assert/strict";
import { store } from "../src/store.js";

assert.equal(store.kind, "postgres");
await store.init();
await store.init(); // idempotent migratsiya

const u = await store.upsertUser({ telegramId: 777, firstName: "Ali", lang: "ru" });
assert.equal(u.lang, "ru");
const u2 = await store.upsertUser({ telegramId: 777, phone: "+998901112233" });
assert.equal(u2.firstName, "Ali", "mavjud maydonlar saqlanadi");
assert.equal(u2.phone, "+998901112233");

const o = await store.createOrder({
  userId: 777, customerName: "Ali", username: "ali", phone: "+998901112233",
  items: [{ productId: "P", variantId: "V", name: "Tufli", variantLabel: "38", sku: "S", price: 100, qty: 2, lineTotal: 200, image: "" }],
  itemsTotal: 200, deliveryFee: 0, grandTotal: 200, deliveryType: "pickup", address: "", lat: null, lng: null,
  deliveryTime: "", express: false, note: "", paymentMethod: "cash", lang: "ru",
});
assert.equal(o.number, o.id + 1000);
assert.equal(o.status, "created");
assert.equal(o.items[0]!.variantLabel, "38");

const up = await store.updateOrder(o.id, { status: "confirmed", history: [...o.history, { status: "confirmed", at: new Date().toISOString(), by: 1 }] });
assert.equal(up!.status, "confirmed");
assert.equal(up!.history.length, 2);
assert.equal((await store.listOrdersByStatus(["confirmed"])).length, 1);
assert.equal((await store.listOrdersByUser(777)).length, 1);
assert.equal((await store.listOrdersSince(new Date(Date.now() - 60_000).toISOString())).length, 1);

await store.addAdminCard({ orderId: o.id, chatId: 1, messageId: 5 });
await store.addAdminCard({ orderId: o.id, chatId: 1, messageId: 5 });
assert.equal((await store.getAdminCards(o.id)).length, 1);

await store.putMedia({ key: "k", contentType: "image/png", data: Buffer.from([1, 2, 3]) });
const m = await store.getMedia("k");
assert.deepEqual([...m!.data], [1, 2, 3]);

await store.kvSet("x", { a: 1, list: [1, 2] });
assert.deepEqual(await store.kvGet("x"), { a: 1, list: [1, 2] });
assert.equal(await store.kvGet("missing"), null);

await store.close();
console.log("✅ Postgres store smoke test o'tdi");
