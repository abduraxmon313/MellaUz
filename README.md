# MELLA — sayt + Telegram bot

> **MELLA** — 2019-yildan buyon ayollar uchun tabiiy charm oyoq kiyimlari, sumka,
> kiyim-kechak va aksessuarlar ishlab chiqaruvchi O‘zbekiston brendi.
> Ushbu repozitoriya **premium brend sayti** va **Telegram bot + Mini App** ni
> o‘z ichiga oladi — ikkalasi bitta repodan **Railway**'da ikki alohida service
> sifatida ishga tushadi.

---

## 🧩 Nimadan iborat

| Service | Papka | Vazifasi | Link (misol) |
|---------|-------|----------|--------------|
| **mella-web** | `apps/web` | Brend/marketing sayti: katalog, mahsulotlar, brend tarixi, buyurtma so‘rovi (lead) | `https://mella.uz` |
| **mella-bot** | `apps/bot` | 2 ta Telegram bot (mijoz + admin) + Mini App (katalog, savat, buyurtma) | `https://app.mella.uz` |

Sayt va bot **bir xil ERP ma’lumotlaridan** foydalanadi (mahsulot, narx, qoldiq),
lekin ikki **alohida Railway service** va **alohida link** sifatida ishlaydi.

### Saytning o‘ziga xosligi
- To‘liq **UZ / RU / EN** (til bo‘yicha SEO, `hreflang`, `sitemap`).
- Saytda **checkout yo‘q** — mijoz **ism va telefon** qoldiradi, so‘rov
  **operatorga** tushadi (Telegram + bizning bazaga saqlanadi).
- Brend palitrasi: Deep Espresso → Gold → Ivory.

---

## ⚙️ Texnologiya

| Qatlam | Tanlov |
|--------|--------|
| Monorepo | **pnpm workspaces** (`apps/*`) |
| Sayt | **Next.js 16** (App Router), **React 19**, **Tailwind CSS v4**, **TypeScript** |
| Bot | **Fastify 5** + **grammY** (webhook), **TypeScript** |
| DB (bizniki) | **PostgreSQL** (sayt so‘rovlari, bot buyurtmalari, mijozlar) — `postgres` drayveri |
| Katalog | **BILLZ 2.0** (bot) / ERP adapter (sayt) yoki namuna (mock) ma’lumot |
| Deploy | **Railway** (Railpack builder), Node.js 24 |

---

## 🔌 ERP integratsiyasi (muhim)

Mahsulot, kategoriya, narx, **qoldiq (stock)** va rasmlar **tashqi ERP tizimidan**
API orqali olinadi. Buyurtmalar esa **bizning bazamizda** saqlanadi.

ERP **adapter** orqasiga yashirilgan (`apps/web/src/lib/catalog/`):

```
Kod → CatalogProvider (interfeys)
         ├─ MockCatalogProvider   (ERP yo‘q bo‘lsa — namuna ma’lumot)
         └─ ErpCatalogProvider    (ERP_API_BASE_URL bo‘lsa — haqiqiy API)
```

- Hozircha `ERP_API_BASE_URL` **bo‘sh** — sayt **namuna katalog** bilan ishlaydi.
- ERP aniqlangach: `apps/web/src/lib/catalog/erp-provider.ts` dagi `mapProduct` /
  `mapCategory` funksiyalarini real API javobiga moslang va env'ga
  `ERP_API_BASE_URL` (+ kerak bo‘lsa `ERP_API_KEY`) qo‘ying. **Qolgan kod
  o‘zgarmaydi.**

---

## 🤖 Telegram botlar va Mini App (`apps/bot`)

Ishlash tuzilmasi **Gunesh** Mini App'idan olingan, dizayn esa **MELLA sayti** bilan bir xil
(espresso/oltin palitra, Cormorant Garamond + Manrope, MELLA emblemasi).

**Mini App:** katalog (kategoriya, qidiruv, saralash) → mahsulot (rasm galereyasi,
**o‘lcham tanlash**, qoldiq) → savat → 2 qadamli rasmiylashtirish (yetkazish/olib ketish,
**Yandex xarita**, telefon, vaqt → to‘lov: **naqd**; Click “tez kunda”) → buyurtmalarim
(holat chizig‘i) → profil (til, aloqa). UZ / RU / EN.

**Mijoz boti:** `/start` → til → telefon → menyu (Do‘kon, Buyurtmalarim, Aloqa, Til).
Buyurtma holati o‘zgarsa mijozga xabar boradi.

**Admin bot:** yangi buyurtma kartasi barcha adminlarga keladi; tugmalar bilan
Qabul → Qadoqlanmoqda → Yo‘lda → Yetkazildi (yoki sabab bilan rad/bekor). Karta hamma
adminlarda birdan yangilanadi. Buyruqlar: `/orders`, `/new`, `/today`, `/sync`, `/billz`.

**BILLZ:** katalog `GET /v2/products` dan har `BILLZ_SYNC_MINUTES` da yangilanadi
(variatsiyalar → bitta karta + o‘lchamlar, aksiya narxi, do‘kon kesimidagi qoldiq,
kategoriya daraxti). Rasmlar BILLZ qoidasiga ko‘ra **o‘z serverimizdan** (`/img/…`, DB keshi)
beriladi. Narx va qoldiq buyurtmada serverda qayta tekshiriladi. `BILLZ_PUSH_SALES=true`
bo‘lsa, yetkazilgan buyurtma BILLZ'ga sotuv sifatida o‘tkaziladi.

Sozlash: `.env.example` dagi `mella-bot` bo‘limi. Lokal sinov:

```bash
pnpm --filter mella-bot dev            # tokensiz — namuna katalog, brauzerda ham buyurtma mumkin
pnpm --filter mella-bot fake-billz     # soxta BILLZ server (:4555)
pnpm --filter mella-bot smoke:billz    # BILLZ integratsiyasi testi (fake-billz yoqilgan holda)
DATABASE_URL=postgres://… pnpm --filter mella-bot smoke:store
```

---

## 🚀 Railway'da ishga tushirish

Railway JS monorepo'ni avtomatik taniydi va **har bir `apps/*` paketi uchun
alohida service** tayyorlaydi.

1. **New Project → Deploy from GitHub repo** → `abduraxmon313/MellaUz` ni tanlang.
2. Railway monorepo'ni aniqlab, **ikki service** taklif qiladi: `mella-web` va
   `mella-bot`. Ikkalasini ham tasdiqlang. (Build/start buyruqlari va healthcheck
   har paketdagi `railway.json` dan o‘qiladi.)
3. **PostgreSQL** plaginini qo‘shing — `DATABASE_URL` avtomatik ulanadi
   (`mella-web` va `mella-bot` service'lariga bog‘lang).
4. Har bir service uchun kerakli **env**'larni qo‘ying (`.env.example` ga qarang).
5. Har bir service'ga **domen** biriktiring (Settings → Networking → Generate
   Domain yoki o‘z domeningiz):
   - `mella-web` → `mella.uz`
   - `mella-bot` → `app.mella.uz`
6. **Botlar**: `BOT_CUSTOMER_TOKEN` va `BOT_ADMIN_TOKEN` qo‘yilsa, server start bo‘lganda
   ikkala webhook va Mini App menyu tugmasi avtomatik o‘rnatiladi. Adminlar admin botga
   `/start` yozib ID'sini oladi → `ADMIN_IDS` ga qo‘shiladi. BILLZ uchun `BILLZ_SECRET_TOKEN`
   qo‘ying, admin botda `/billz` bilan do‘kon ID'larini olib `BILLZ_SHOP_IDS` ga yozing.

> **Eslatma (monorepo):** service **Root Directory** bo‘sh (repo ildizi) bo‘lishi
> kerak — shunda `pnpm-lock.yaml` va workspace to‘liq ko‘rinadi. Build/start
> buyruqlari `pnpm --filter <paket> ...` ko‘rinishida (railway.json da tayyor).

---

## 🖥 Lokal ishga tushirish

```bash
# Talablar: Node.js 24, pnpm 10+ (corepack enable)
pnpm install

# Sayt (http://localhost:3000)
pnpm dev:web

# Bot + Mini App (http://localhost:3001)
pnpm dev:bot

# Ikkalasi birga
pnpm dev
```

Build va tekshiruv:

```bash
pnpm build        # ikkala paketni build qiladi
pnpm typecheck    # TypeScript tekshiruvi
pnpm lint
```

---

## 📂 Tuzilish

```
MellaUz/
├─ apps/
│  ├─ web/                     # Service 1: brend sayti (Next.js 16)
│  │  ├─ src/
│  │  │  ├─ app/[lang]/        # UZ/RU/EN sahifalar (home, catalog, product, about, contact)
│  │  │  ├─ app/api/           # /health, /lead (buyurtma so‘rovi)
│  │  │  ├─ components/        # Header, Footer, ProductCard, OrderForm, ...
│  │  │  ├─ i18n/              # tillar va lug‘atlar
│  │  │  ├─ lib/catalog/       # ERP adapter + namuna katalog
│  │  │  ├─ lib/leads.ts       # buyurtma so‘rovi (Postgres + Telegram)
│  │  │  └─ proxy.ts           # til yo‘naltirish (middleware)
│  │  └─ railway.json
│  └─ bot/                     # Service 2: Telegram bot + Mini App (Fastify + grammY)
│     ├─ src/                  # server, api, bot (mijoz), admin/ (admin bot), billz/, catalog/, orders, store
│     ├─ public/               # Mini App (index.html, app.js, styles.css)
│     ├─ scripts/              # fake-billz, smoke testlar
│     └─ railway.json
├─ pnpm-workspace.yaml
├─ package.json
└─ .env.example
```

---

## 🗺 Keyingi bosqichlar

- [x] Mini App to‘liq xarid oqimi (katalog, savat, buyurtma) — BILLZ katalogi bilan.
- [x] Admin bot: buyurtmalarni qabul/tasdiqlash, BILLZ'ga sotuv o‘tkazish (ixtiyoriy).
- [ ] Saytni ham BILLZ katalogiga ulash (`ErpCatalogProvider` → BILLZ).
- [ ] Click orqali onlayn to‘lov (sinovlardan so‘ng).

---

🟢 **Holat:** premium sayt tayyor (UZ/RU/EN, katalog, mahsulot, aloqa, buyurtma
so‘rovi) + mijoz/admin botlar va Mini App (BILLZ). Railway'da ikki service sifatida deploy'ga tayyor.

> Namuna rasmlar manbasi: [`CREDITS.md`](CREDITS.md).
