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
| **mella-bot** | `apps/bot` | Telegram Sotuv bot + Mini App backend | `https://app.mella.uz` |

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
| DB (bizniki) | **PostgreSQL** (buyurtma so‘rovlari) — `postgres` drayveri |
| Katalog | **ERP API** (adapter orqali) yoki namuna (mock) ma’lumot |
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

## 🚀 Railway'da ishga tushirish

Railway JS monorepo'ni avtomatik taniydi va **har bir `apps/*` paketi uchun
alohida service** tayyorlaydi.

1. **New Project → Deploy from GitHub repo** → `abduraxmon313/MellaUz` ni tanlang.
2. Railway monorepo'ni aniqlab, **ikki service** taklif qiladi: `mella-web` va
   `mella-bot`. Ikkalasini ham tasdiqlang. (Build/start buyruqlari va healthcheck
   har paketdagi `railway.json` dan o‘qiladi.)
3. **PostgreSQL** plaginini qo‘shing — `DATABASE_URL` avtomatik ulanadi
   (`mella-web` service'ga bog‘lang).
4. Har bir service uchun kerakli **env**'larni qo‘ying (`.env.example` ga qarang).
5. Har bir service'ga **domen** biriktiring (Settings → Networking → Generate
   Domain yoki o‘z domeningiz):
   - `mella-web` → `mella.uz`
   - `mella-bot` → `app.mella.uz`
6. **Bot**: `BOT_CUSTOMER_TOKEN` qo‘yilsa, server start bo‘lganda webhook va
   Mini App menyu tugmasi avtomatik o‘rnatiladi (`PUBLIC_URL`/Railway domeni
   asosida). BotFather’da Mini App URL sifatida `mella-bot` domenini bering.

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
│     ├─ src/                  # config, bot, server
│     ├─ public/               # Mini App (placeholder)
│     └─ railway.json
├─ pnpm-workspace.yaml
├─ package.json
└─ .env.example
```

---

## 🗺 Keyingi bosqichlar

- [ ] ERP API ulanishi (real `ErpCatalogProvider`).
- [ ] Mini App to‘liq xarid oqimi (katalog, savat, buyurtma).
- [ ] Admin bot: buyurtmalarni qabul/tasdiqlash, ERP qoldig‘ini kamaytirish.
- [ ] Click orqali onlayn to‘lov (sinovlardan so‘ng).

---

🟢 **Holat:** premium sayt tayyor (UZ/RU/EN, katalog, mahsulot, aloqa, buyurtma
so‘rovi) + bot/Mini App starter. Railway'da ikki service sifatida deploy'ga tayyor.

> Namuna rasmlar manbasi: [`CREDITS.md`](CREDITS.md).
