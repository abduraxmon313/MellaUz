/* eslint-disable */
/**
 * Namuna katalog (apps/web/src/lib/catalog/mock-data.ts dan nusxa).
 * BILLZ_SECRET_TOKEN qo‘yilmaguncha Mini App shu ma’lumot bilan ishlaydi.
 */
type L = { uz: string; ru: string; en: string };
export interface MockCategory { slug: string; order: number; name: L; tagline?: L; image: string }
export interface MockProduct { slug: string; sku: string; categorySlug: string; featured?: boolean; price: number; oldPrice?: number; stock: number; images: string[]; name: L; description: L; material?: L }

/**
 * Namuna (mock) katalog — ERP API tayyor bo'lmaguncha ishlatiladi.
 * Mahsulot nomlari O‘zbekiston shaharlari nomidan ilhomlangan (brend uslubi).
 * Rasmlar: public/images/products/*.jpg (bepul litsenziyali, Pexels).
 */

export const categories: MockCategory[] = [
  {
    slug: "poyabzal",
    order: 1,
    name: { uz: "Oyoq kiyim", ru: "Обувь", en: "Footwear" },
    tagline: {
      uz: "Tabiiy charmdan tuflilar, etiklar va bosonojkalar",
      ru: "Туфли, ботинки и босоножки из натуральной кожи",
      en: "Heels, boots and sandals in genuine leather",
    },
    image: "/images/products/samarqand-1.jpg",
  },
  {
    slug: "sumkalar",
    order: 2,
    name: { uz: "Sumkalar", ru: "Сумки", en: "Bags" },
    tagline: {
      uz: "Kundalik va bayram uchun charm sumkalar",
      ru: "Кожаные сумки на каждый день и для особых случаев",
      en: "Leather bags for every day and special occasions",
    },
    image: "/images/products/registon-1.jpg",
  },
  {
    slug: "kiyim",
    order: 3,
    name: { uz: "Kiyim-kechak", ru: "Одежда", en: "Clothing" },
    tagline: {
      uz: "Zamonaviy va nafis ayollar kiyimi",
      ru: "Современная и элегантная женская одежда",
      en: "Modern and elegant womenswear",
    },
    image: "/images/products/toshkent-1.jpg",
  },
  {
    slug: "aksessuarlar",
    order: 4,
    name: { uz: "Aksessuarlar", ru: "Аксессуары", en: "Accessories" },
    tagline: {
      uz: "Ro‘mol, qo‘lqop va nozik detallar",
      ru: "Платки, перчатки и изысканные детали",
      en: "Scarves, gloves and refined details",
    },
    image: "/images/products/margilon-1.jpg",
  },
];

export const products: MockProduct[] = [
  // ── Oyoq kiyim ──────────────────────────────────────────────
  {
    slug: "samarqand-klassik-tufli",
    sku: "MF-1001",
    categorySlug: "poyabzal",
    featured: true,
    price: 890000,
    stock: 12,
    images: ["/images/products/samarqand-1.jpg"],
    name: {
      uz: "Samarqand klassik tufli",
      ru: "Классические туфли «Самарканд»",
      en: "Samarqand classic heels",
    },
    description: {
      uz: "Tabiiy charmdan tikilgan nafis klassik tufli. Kundalik va tantanali uslub uchun ideal.",
      ru: "Элегантные классические туфли из натуральной кожи. Идеальны для повседневного и торжественного образа.",
      en: "Elegant classic heels crafted in genuine leather. Ideal for both daily and formal looks.",
    },
    material: {
      uz: "Tabiiy charm (qo‘y terisi)",
      ru: "Натуральная кожа (овчина)",
      en: "Genuine leather (sheepskin)",
    },
  },
  {
    slug: "nurota-bosonojka",
    sku: "MF-1002",
    categorySlug: "poyabzal",
    featured: true,
    price: 760000,
    oldPrice: 920000,
    stock: 7,
    images: ["/images/products/nurota-1.jpg"],
    name: {
      uz: "Nurota bosonojka",
      ru: "Босоножки «Нурата»",
      en: "Nurota strappy sandal",
    },
    description: {
      uz: "Baland poshnali nafis bosonojka — yoz va bayram kechalari uchun.",
      ru: "Изящные босоножки на высоком каблуке — для лета и праздничных вечеров.",
      en: "Refined high-heel sandals — for summer and festive evenings.",
    },
    material: {
      uz: "Tabiiy charm",
      ru: "Натуральная кожа",
      en: "Genuine leather",
    },
  },
  {
    slug: "xiva-charm-etik",
    sku: "MF-1003",
    categorySlug: "poyabzal",
    price: 1180000,
    stock: 9,
    images: ["/images/products/xiva-1.jpg"],
    name: {
      uz: "Xiva charm etik",
      ru: "Кожаные сапоги «Хива»",
      en: "Xiva leather boots",
    },
    description: {
      uz: "Uzun qo‘njli tabiiy charm etik. Issiq va zamonaviy — kuz-qish mavsumi uchun.",
      ru: "Высокие сапоги из натуральной кожи. Тёплые и современные — для осенне-зимнего сезона.",
      en: "Tall genuine-leather boots. Warm and modern — for the autumn–winter season.",
    },
    material: {
      uz: "Tabiiy charm",
      ru: "Натуральная кожа",
      en: "Genuine leather",
    },
  },
  {
    slug: "zomin-etik",
    sku: "MF-1004",
    categorySlug: "poyabzal",
    featured: true,
    price: 1090000,
    stock: 5,
    images: ["/images/products/zomin-1.jpg"],
    name: {
      uz: "Zomin etik",
      ru: "Сапоги «Зомин»",
      en: "Zomin boots",
    },
    description: {
      uz: "Minimalistik dizayndagi charm etik — kundalik uslubga mukammal mos.",
      ru: "Кожаные сапоги в минималистичном дизайне — отлично подходят для повседневного образа.",
      en: "Minimalist leather boots — a perfect match for everyday style.",
    },
  },
  {
    slug: "termiz-botinka",
    sku: "MF-1005",
    categorySlug: "poyabzal",
    price: 940000,
    stock: 0,
    images: ["/images/products/termiz-1.jpg"],
    name: {
      uz: "Termiz botinka",
      ru: "Ботильоны «Термез»",
      en: "Termiz ankle boots",
    },
    description: {
      uz: "Qisqa qo‘njli zamonaviy botinka. Shahar uslubi uchun qulay yechim.",
      ru: "Современные ботильоны. Удобное решение для городского стиля.",
      en: "Modern ankle boots. A comfortable choice for city style.",
    },
  },
  {
    slug: "buxoro-loafer",
    sku: "MF-1006",
    categorySlug: "poyabzal",
    price: 820000,
    stock: 14,
    images: ["/images/products/buxoro-1.jpg"],
    name: {
      uz: "Buxoro loafer",
      ru: "Лоферы «Бухара»",
      en: "Bukhara loafers",
    },
    description: {
      uz: "Timsoh naqshli charmdan tikilgan loafer. Qulay va zamonaviy.",
      ru: "Лоферы из кожи с тиснением под крокодила. Удобные и современные.",
      en: "Loafers in croc-embossed leather. Comfortable and modern.",
    },
  },
  {
    slug: "buxoro-classic-loafer",
    sku: "MF-1007",
    categorySlug: "poyabzal",
    price: 860000,
    stock: 6,
    images: ["/images/products/buxoro-2.jpg"],
    name: {
      uz: "Buxoro Classic loafer",
      ru: "Лоферы «Бухара Классик»",
      en: "Bukhara Classic loafers",
    },
    description: {
      uz: "Klassik ko‘rinishdagi charm loafer — ofis va kundalik uslub uchun.",
      ru: "Классические кожаные лоферы — для офиса и повседневного образа.",
      en: "Classic leather loafers — for the office and everyday wear.",
    },
  },
  // ── Sumkalar ────────────────────────────────────────────────
  {
    slug: "registon-tote",
    sku: "MB-2001",
    categorySlug: "sumkalar",
    featured: true,
    price: 1290000,
    stock: 10,
    images: ["/images/products/registon-1.jpg"],
    name: {
      uz: "Registon tote sumka",
      ru: "Сумка-тоут «Регистан»",
      en: "Registon tote bag",
    },
    description: {
      uz: "Keng va qulay tabiiy charm tote sumka — kundalik hamroh.",
      ru: "Вместительная и удобная сумка-тоут из натуральной кожи — спутник на каждый день.",
      en: "A roomy, comfortable genuine-leather tote — your everyday companion.",
    },
    material: {
      uz: "Tabiiy charm",
      ru: "Натуральная кожа",
      en: "Genuine leather",
    },
  },
  {
    slug: "registon-shoulder",
    sku: "MB-2002",
    categorySlug: "sumkalar",
    price: 1150000,
    stock: 8,
    images: ["/images/products/registon-2.jpg"],
    name: {
      uz: "Registon yelka sumka",
      ru: "Сумка через плечо «Регистан»",
      en: "Registon shoulder bag",
    },
    description: {
      uz: "Nafis yelka sumka — tantanali va kundalik liboslarga mos.",
      ru: "Изящная сумка через плечо — подходит к праздничным и повседневным образам.",
      en: "An elegant shoulder bag — suited to both festive and everyday outfits.",
    },
  },
  {
    slug: "registon-travel",
    sku: "MB-2003",
    categorySlug: "sumkalar",
    price: 1690000,
    stock: 4,
    images: ["/images/products/registon-3.jpg"],
    name: {
      uz: "Registon travel sumka",
      ru: "Дорожная сумка «Регистан»",
      en: "Registon travel bag",
    },
    description: {
      uz: "Sayohat uchun keng charm sumka — mustahkam va chiroyli.",
      ru: "Вместительная кожаная сумка для путешествий — прочная и красивая.",
      en: "A spacious leather travel bag — durable and beautiful.",
    },
  },
  {
    slug: "shahrisabz-tote",
    sku: "MB-2004",
    categorySlug: "sumkalar",
    featured: true,
    price: 1390000,
    stock: 11,
    images: ["/images/products/shahrisabz-1.jpg"],
    name: {
      uz: "Shahrisabz tote sumka",
      ru: "Сумка-тоут «Шахрисабз»",
      en: "Shahrisabz tote bag",
    },
    description: {
      uz: "Yumshoq charmdan tikilgan nafis tote — har kuni uchun zarur aksessuar.",
      ru: "Изящный тоут из мягкой кожи — необходимый аксессуар на каждый день.",
      en: "An elegant tote in soft leather — an everyday essential.",
    },
  },
  {
    slug: "afrosiyob-clutch",
    sku: "MB-2005",
    categorySlug: "sumkalar",
    price: 850000,
    stock: 9,
    images: ["/images/products/afrosiyob-1.jpg"],
    name: {
      uz: "Afrosiyob klatch",
      ru: "Клатч «Афросиаб»",
      en: "Afrosiyob clutch",
    },
    description: {
      uz: "Ixcham va nafis klatch — bayram kechalari uchun.",
      ru: "Компактный и изящный клатч — для праздничных вечеров.",
      en: "A compact, elegant clutch — for festive evenings.",
    },
  },
  // ── Kiyim-kechak ────────────────────────────────────────────
  {
    slug: "toshkent-trench",
    sku: "MC-3001",
    categorySlug: "kiyim",
    featured: true,
    price: 2290000,
    stock: 6,
    images: ["/images/products/toshkent-1.jpg"],
    name: {
      uz: "Toshkent trench palto",
      ru: "Тренч «Ташкент»",
      en: "Tashkent trench coat",
    },
    description: {
      uz: "Klassik trench palto — nafis va universal, har mavsumga mos.",
      ru: "Классический тренч — элегантный и универсальный, для любого сезона.",
      en: "A classic trench coat — elegant and versatile for any season.",
    },
  },
  {
    slug: "fargona-sviter",
    sku: "MC-3002",
    categorySlug: "kiyim",
    price: 1240000,
    stock: 10,
    images: ["/images/products/fargona-1.jpg"],
    name: {
      uz: "Farg‘ona trikotaj sviter",
      ru: "Трикотажный свитер «Фергана»",
      en: "Fergana knit sweater",
    },
    description: {
      uz: "Yumshoq va issiq trikotaj sviter — kuz-qish uchun qulay tanlov.",
      ru: "Мягкий и тёплый трикотажный свитер — удобный выбор для осени и зимы.",
      en: "A soft, warm knit sweater — a cosy choice for autumn and winter.",
    },
  },
  // ── Aksessuarlar ────────────────────────────────────────────
  {
    slug: "margilon-ipak-romol",
    sku: "MA-4001",
    categorySlug: "aksessuarlar",
    featured: true,
    price: 390000,
    stock: 20,
    images: ["/images/products/margilon-1.jpg"],
    name: {
      uz: "Marg‘ilon ipak ro‘mol",
      ru: "Шёлковый платок «Маргилан»",
      en: "Margilan silk scarf",
    },
    description: {
      uz: "Nafis ipak ro‘mol — har qanday libosga nafosat qo‘shadi.",
      ru: "Изящный шёлковый платок — добавит утончённость любому образу.",
      en: "A refined silk scarf — adds elegance to any outfit.",
    },
    material: {
      uz: "Tabiiy ipak",
      ru: "Натуральный шёлк",
      en: "Natural silk",
    },
  },
  {
    slug: "qoqon-charm-qolqop",
    sku: "MA-4002",
    categorySlug: "aksessuarlar",
    price: 450000,
    stock: 15,
    images: ["/images/products/qoqon-1.jpg"],
    name: {
      uz: "Qo‘qon charm qo‘lqop",
      ru: "Кожаные перчатки «Коканд»",
      en: "Kokand leather gloves",
    },
    description: {
      uz: "Tabiiy charm qo‘lqop — issiq, nafis va chidamli.",
      ru: "Перчатки из натуральной кожи — тёплые, элегантные и прочные.",
      en: "Genuine-leather gloves — warm, elegant and durable.",
    },
    material: {
      uz: "Tabiiy charm",
      ru: "Натуральная кожа",
      en: "Genuine leather",
    },
  },
];
