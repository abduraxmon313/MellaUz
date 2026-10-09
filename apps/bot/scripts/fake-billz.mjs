// BILLZ 2.0 API'ning minimal soxta serveri — integratsiyani lokal sinash uchun.
//   node scripts/fake-billz.mjs   →  http://127.0.0.1:4555
import http from "node:http";

const SHOP_A = "aaaaaaaa-0000-0000-0000-000000000001";
const SHOP_B = "bbbbbbbb-0000-0000-0000-000000000002";
const CAT_SHOES = "c0000000-0000-0000-0000-000000000001";
const CAT_HEELS = "c0000000-0000-0000-0000-000000000011"; // Обувь > Tufli
const CAT_BAGS = "c0000000-0000-0000-0000-000000000002";
const PORT = Number(process.env.FAKE_BILLZ_PORT || 4555);
const IMG = (n) => `http://127.0.0.1:${PORT}/cdn/${n}.jpg`;
const SIMPLE = "69e939aa-9b8f-46a9-b605-8b2675475b7b";
const calls = [];
let tokenN = 0;
let page429 = true;

const prices = (retail, promo) => [
  { shop_id: SHOP_A, shop_name: "Mella Chilonzor", retail_price: retail, retail_currency: "UZS", promo_price: promo || 0, promos: promo ? [{ id: "p1", name: "-20%", discount_type: "PERCENTAGE", discount_value: 20 }] : [] },
  { shop_id: SHOP_B, shop_name: "Mella Online", retail_price: retail + 50000, retail_currency: "UZS", promo_price: 0, promos: [] },
];
const stock = (a, b) => [
  { shop_id: SHOP_A, shop_name: "A", active_measurement_value: a },
  { shop_id: SHOP_B, shop_name: "B", active_measurement_value: b },
];

const products = [
  { id: "P-HEEL", name: "Samarqand tufli", is_variative: true, parent_id: "", sku: "MF-1001", brand_name: "MELLA", description: "Tabiiy charm tufli", categories: [{ id: CAT_HEELS, name: "Tufli", parent_id: CAT_SHOES }], photos: [{ photo_url: IMG("heel-2"), sequence: 2 }, { photo_url: IMG("heel-1"), sequence: 1, is_main: true }], product_type_id: SIMPLE, shop_prices: [], shop_measurement_values: [], updated_at: "2026-10-01 10:00:00" },
  { id: "V-HEEL-38", name: "Samarqand tufli / 38", parent_id: "P-HEEL", sku: "MF-1001-38", barcode: "100138", product_attributes: [{ attribute_name: "Размер", attribute_value: "38" }], shop_prices: prices(890000, 712000), shop_measurement_values: stock(2, 1), product_type_id: SIMPLE, photos: [], updated_at: "2026-10-05 10:00:00" },
  { id: "V-HEEL-36", name: "Samarqand tufli / 36", parent_id: "P-HEEL", sku: "MF-1001-36", product_attributes: [{ attribute_name: "Размер", attribute_value: "36" }], shop_prices: prices(890000, 712000), shop_measurement_values: stock(0, 0), product_type_id: SIMPLE, updated_at: "2026-10-05 10:00:00" },
  { id: "V-HEEL-40", name: "Samarqand tufli / 40", parent_id: "P-HEEL", sku: "MF-1001-40", product_attributes: [{ attribute_name: "Размер", attribute_value: "40" }], shop_prices: prices(890000, 712000), shop_measurement_values: stock(1, 0), product_type_id: SIMPLE, updated_at: "2026-10-05 10:00:00" },
  { id: "P-BAG", name: "Registon tote", sku: "MB-2001", brand_name: "MELLA", description: "Charm sumka", categories: [{ id: CAT_BAGS, name: "Сумки", parent_id: "" }], main_image_url: IMG("bag"), photos: [{ photo_url: IMG("bag"), is_main: true }], shop_prices: prices(1290000), shop_measurement_values: stock(3, 2), product_type_id: SIMPLE, updated_at: "2026-10-03 10:00:00" },
  { id: "P-NOPRICE", name: "Narxsiz", categories: [{ id: CAT_BAGS, name: "Сумки" }], shop_prices: [], shop_measurement_values: stock(5, 0), product_type_id: SIMPLE },
  { id: "P-SERVICE", name: "Qadoqlash xizmati", shop_prices: prices(10000), product_type_id: "5a0e556a-15f8-47ac-ae07-46972f3c6ab4" },
];

const tree = [
  { id: CAT_SHOES, name: "Обувь", parent_id: "", subRows: [{ id: CAT_HEELS, name: "Tufli", parent_id: CAT_SHOES, subRows: [] }] },
  { id: CAT_BAGS, name: "Сумки", parent_id: "", subRows: [] },
];

function send(res, code, body) { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); }

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  let body = "";
  for await (const ch of req) body += ch;
  if (url.pathname === "/_calls") return send(res, 200, calls);
  calls.push(`${req.method} ${url.pathname}${url.search}${req.headers["billz-response-channel"] ? " [HTTP]" : ""} ${body.slice(0, 140)}`);
  if (url.pathname.startsWith("/cdn/")) { res.writeHead(200, { "content-type": "image/jpeg" }); return res.end(Buffer.from("FAKEJPEG-" + url.pathname)); }
  if (url.pathname === "/v1/auth/login") {
    const b = JSON.parse(body || "{}");
    if (b.secret_token !== "test-secret") return send(res, 401, { code: 401, message: "bad secret" });
    tokenN++; return send(res, 200, { code: 200, data: { access_token: "AT" + tokenN, refresh_token: "RT" + tokenN, expires_in: 1296000 } });
  }
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer AT")) return send(res, 401, { code: 401, message: "token error", error: "Token is expired" });
  if (url.pathname === "/v2/products") {
    if (page429) { page429 = false; return send(res, 429, { message: "too many" }); }
    const limit = Number(url.searchParams.get("limit")), page = Number(url.searchParams.get("page"));
    return send(res, 200, { count: products.length, products: products.slice((page - 1) * limit, page * limit) });
  }
  if (url.pathname === "/v2/category") return send(res, 200, { count: 2, categories: tree });
  if (url.pathname === "/v1/shop") return send(res, 200, { count: 2, shops: [{ id: SHOP_A, name: "Mella Chilonzor" }, { id: SHOP_B, name: "Mella Online" }] });
  if (url.pathname === "/v1/client" && req.method === "GET") return send(res, 200, { count: 0, clients: [] });
  if (url.pathname === "/v1/client" && req.method === "POST") return send(res, 200, { id: "CLIENT-1" });
  if (url.pathname === "/v2/order" && req.method === "POST") return send(res, 200, { status_code: 200, id: "SALE-1", data: { id: "SALE-1", order_number: "777" }, error: { code: "", message: "" } });
  if (url.pathname.startsWith("/v2/order-product/")) return send(res, 200, { status_code: 200, error: { code: "", message: "" } });
  if (url.pathname.startsWith("/v2/order-customer-new/")) return send(res, 200, { status_code: 200, data: {} });
  if (url.pathname.startsWith("/v2/order-manual-discount/")) return send(res, 200, { status_code: 200 });
  if (url.pathname.startsWith("/v1/recalculate-order-bill/")) {
    const discounted = calls.some((c) => c.includes("order-manual-discount"));
    return send(res, 200, { total_price: discounted ? 712000 : 890000 });
  }
  if (url.pathname.startsWith("/v2/order-payment/")) return send(res, 200, { order_type: "SALE", should_print_cheque: true });
  send(res, 404, { message: "not found " + url.pathname });
}).listen(PORT, "127.0.0.1", () => console.log(`fake billz :${PORT}`));
