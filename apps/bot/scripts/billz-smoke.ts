/**
 * BILLZ integratsiyasi tutun-testi (soxta BILLZ server bilan):
 *   node scripts/fake-billz.mjs &   pnpm smoke:billz
 *
 * BILLZ_PAGE_LIMIT=2 — variatsiyalar ataylab turli sahifalarga tushadi
 * (haqiqiy 23k katalogdagi holat), guruhlash butun ro'yxat bo'yicha ishlashi shart.
 */
import assert from "node:assert/strict";
import {
  catalogStatus,
  findVariant,
  getProductDetail,
  initCatalog,
  listCategories,
  listProducts,
  listShops,
  syncChanges,
  syncNow,
} from "../src/catalog/index.js";
import { changeStatus, createOrder, OrderError } from "../src/orders.js";
import { store } from "../src/store.js";

const SHOP_A = "aaaaaaaa-0000-0000-0000-000000000001";
const SHOP_B = "bbbbbbbb-0000-0000-0000-000000000002";

await store.init();
await initCatalog();
await syncNow();
const st = catalogStatus();
console.log("status:", st);
assert.equal(st.source, "billz");
assert.equal(st.lastError, "");

// ── Kategoriyalar: faqat mahsuloti borlari, soni bilan, "undefined" yo'q ──
const cats = listCategories("uz");
console.log("categories:", cats);
assert.deepEqual(cats.map((c) => c.name).sort(), ["Обувь", "Сумки"], "bo'sh kategoriyalar ('2', 'qora') chiqmasligi kerak");
for (const c of cats) assert.ok(typeof c.count === "number" && c.count > 0, "har kategoriyada son bo'lishi kerak");

// ── Ro'yxat: takrorlanish yo'q, variatsiyalar bitta kartada ──
const page1 = listProducts({ page: 1, limit: 20 }, "uz");
console.log("products:", page1.products.map((p) => [p.id, p.name, p.category, p.price, p.stock, p.has_variants, Boolean(p.image)]));
const ids = page1.products.map((p) => p.id);
assert.equal(new Set(ids).size, ids.length, "kartalar takrorlanmasligi kerak");
const names = page1.products.map((p) => p.name);
assert.equal(new Set(names).size, names.length, "bir xil nomli mahsulot bitta karta bo'lishi kerak");
assert.equal(page1.total, 3, "Samarqand tufli + Magza 284 + Registon tote (narxsiz va xizmat yashirin)");
for (const p of page1.products) {
  assert.ok(p.category, `${p.name}: kategoriya nomi bo'lishi kerak`);
  assert.ok(p.image, `${p.name}: rasm bo'lishi kerak`);
}

// Sahifalash
const pA = listProducts({ page: 1, limit: 2 }, "uz");
const pB = listProducts({ page: 2, limit: 2 }, "uz");
assert.equal(pA.has_more, true);
assert.equal(pB.has_more, false);
assert.equal(new Set([...pA.products, ...pB.products].map((p) => p.id)).size, 3, "sahifalar orasida takror yo'q");

// Kategoriya filtri
const shoesId = cats.find((c) => c.name === "Обувь")!.id;
const shoes = listProducts({ category: shoesId }, "uz");
assert.equal(shoes.total, 2);

// ── Mahsulot oynasi: karta ID va variant ID bo'yicha ──
const heel = getProductDetail("P-HEEL", "uz")!;
console.log("heel:", heel.variants, heel.images);
assert.deepEqual(heel.variants.map((v) => v.label), ["36", "38", "40"]);
assert.equal(heel.price, 712000, "aksiya narxi");
assert.equal(heel.old_price, 890000);
assert.equal(heel.images.length, 2);
assert.equal(getProductDetail("V-HEEL-38", "uz")?.id, "P-HEEL", "variant ID bo'yicha ham topiladi");

const magza = page1.products.find((p) => p.name === "Magza 284")!;
const mz = getProductDetail(magza.id, "uz")!;
assert.deepEqual(mz.variants.map((v) => v.label), ["38", "39"], "alohida tovar qilib kiritilgan o'lchamlar birlashtiriladi");

// ── Filial tanlash ──
assert.equal(listShops().length, 2);
const heelA = getProductDetail("P-HEEL", "uz", SHOP_A)!;
const heelB = getProductDetail("P-HEEL", "uz", SHOP_B)!;
assert.equal(heelA.variants.find((v) => v.label === "38")!.stock, 2);
assert.equal(heelB.variants.find((v) => v.label === "38")!.stock, 1);
assert.equal(heelB.price, 940000, "B filialda aksiya yo'q");
assert.equal(getProductDetail("P-HEEL", "uz")!.variants.find((v) => v.label === "38")!.stock, 3, "barcha filiallar yig'indisi");

// ── Buyurtma: BILLZ variantlari topiladi, qoldiq tekshiriladi ──
assert.ok(findVariant("V-HEEL-38"), "BILLZ varianti buyurtma uchun topilishi kerak");
await assert.rejects(
  createOrder({ id: 42, first_name: "Ali" }, { items: [{ variant_id: "V-HEEL-38", qty: 4 }], delivery_type: "pickup", phone: "901112233" }, "uz"),
  (e: unknown) => e instanceof OrderError && /3 dona/.test((e as Error).message),
);
const order = await createOrder(
  { id: 42, first_name: "Ali", last_name: "Valiyev" },
  { items: [{ variant_id: "V-HEEL-38", qty: 1 }], delivery_type: "pickup", phone: "+998 90 111 22 33" },
  "uz",
);
assert.equal(order.itemsTotal, 712000);
await changeStatus(order.id, "confirmed", 1);
await changeStatus(order.id, "delivered", 1);
for (let i = 0; i < 40; i++) {
  const o = await store.getOrder(order.id);
  if (o?.billzDone || o?.billzError) break;
  await new Promise((r) => setTimeout(r, 250));
}
const fin = (await store.getOrder(order.id))!;
assert.equal(fin.billzDone, true, fin.billzError);

// ── O'zgarganlarni yangilash (last_updated_date) ──
await fetch("http://127.0.0.1:4555/_bump");
await syncChanges();
const bag = getProductDetail("P-BAG", "uz")!;
assert.equal(bag.price, 1190000, "o'zgargan narx yangilanishi kerak");
assert.equal(listProducts({}, "uz").total, 3, "yangilashdan keyin ham takror yo'q");

const calls = (await (await fetch("http://127.0.0.1:4555/_calls")).json()) as string[];
assert.ok(calls.some((c) => c.includes("last_updated_date=")), "delta so'rovi yuborilishi kerak");
console.log(`BILLZ so'rovlari: ${calls.length}`);
console.log("\n✅ BILLZ smoke test o'tdi");
process.exit(0);
