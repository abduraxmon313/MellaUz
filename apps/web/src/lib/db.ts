import "server-only";

import postgres from "postgres";

/**
 * PostgreSQL ulanishlari.
 *  - primary: saytning o'z bazasi (DATABASE_URL) — so'rovlar va qo'lda kiritilgan katalog.
 *  - mirror:  Mini App (bot) bazasi (BOT_DATABASE_URL) — admin kiritgan mahsulotlar shu yerga
 *             ham nusxalanadi, shunda Mini App ularni o'z bazasidan o'qiydi.
 */
export type Sql = ReturnType<typeof postgres>;

function connect(url: string): Sql {
  // Railway ichki tarmog'i (*.railway.internal) va lokal baza — SSL'siz; tashqi ulanish — SSL.
  const local = /localhost|127\.0\.0\.1|\.railway\.internal/.test(url);
  return postgres(url, {
    ssl: local ? false : "require",
    max: 3,
    idle_timeout: 20,
    connect_timeout: 5,
    onnotice: () => {},
  });
}

// API va sahifa bundle'lari bitta ulanish hovuzidan foydalansin (globalThis — jarayon bo'yicha umumiy).
const g = globalThis as typeof globalThis & { __mellaPools?: Map<string, Sql> };
const pools: Map<string, Sql> = (g.__mellaPools ??= new Map());

function pool(url: string | undefined): Sql | null {
  if (!url) return null;
  let sql = pools.get(url);
  if (!sql) {
    sql = connect(url);
    pools.set(url, sql);
  }
  return sql;
}

export function primaryDb(): Sql | null {
  return pool(process.env.DATABASE_URL);
}

export function mirrorDb(): Sql | null {
  const url = process.env.BOT_DATABASE_URL;
  // Bir xil baza ko'rsatilgan bo'lsa — ikki marta yozmaymiz.
  if (!url || url === process.env.DATABASE_URL) return null;
  return pool(url);
}
