import "server-only";

import { primaryDb, type Sql } from "./db";
import type { Locale } from "@/i18n/config";

export interface LeadInput {
  name: string;
  phone: string;
  product?: string;
  note?: string;
  locale: Locale;
  source?: string;
}

// ── Postgres (bizning DB — buyurtma so'rovlari shu yerda saqlanadi) ──
// Ulanish lib/db.ts da (Railway ichki tarmog'i uchun to'g'ri SSL sozlamasi bilan).
let schemaReady = false;
const db = primaryDb;

async function ensureSchema(client: Sql) {
  if (schemaReady) return;
  await client`
    CREATE TABLE IF NOT EXISTS leads (
      id          BIGSERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      phone       TEXT NOT NULL,
      product     TEXT,
      note        TEXT,
      locale      TEXT NOT NULL DEFAULT 'uz',
      source      TEXT NOT NULL DEFAULT 'website',
      status      TEXT NOT NULL DEFAULT 'new',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  schemaReady = true;
}

/**
 * Buyurtma so'rovini saqlaydi (DATABASE_URL bo'lsa) va operatorga
 * Telegram orqali xabar yuboradi (token sozlangan bo'lsa).
 * Har ikkisi ham ixtiyoriy — sozlanmagan bo'lsa jim o'tkazib yuboradi,
 * foydalanuvchi baribir "muvaffaqiyatli" javob oladi.
 */
export async function saveLead(input: LeadInput): Promise<{ stored: boolean; notified: boolean }> {
  let stored = false;
  let notified = false;

  const client = db();
  if (client) {
    try {
      await ensureSchema(client);
      await client`
        INSERT INTO leads ${client({
          name: input.name,
          phone: input.phone,
          product: input.product ?? null,
          note: input.note ?? null,
          locale: input.locale,
          source: input.source ?? "website",
        })}
      `;
      stored = true;
    } catch (err) {
      console.error("[leads] DB saqlash xatosi:", err);
    }
  }

  notified = await notifyTelegram(input);
  return { stored, notified };
}

// ── Telegram (operatorga darhol xabar) ──────────────────────────────
async function notifyTelegram(input: LeadInput): Promise<boolean> {
  const token = process.env.TELEGRAM_LEAD_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_LEAD_CHAT_ID;
  if (!token || !chatId) return false;

  const lines = [
    "🛍 <b>Yangi buyurtma so'rovi</b>",
    `👤 <b>Ism:</b> ${escapeHtml(input.name)}`,
    `📞 <b>Telefon:</b> ${escapeHtml(input.phone)}`,
  ];
  if (input.product) lines.push(`📦 <b>Mahsulot:</b> ${escapeHtml(input.product)}`);
  if (input.note) lines.push(`📝 <b>Izoh:</b> ${escapeHtml(input.note)}`);
  lines.push(`🌐 <b>Til:</b> ${input.locale.toUpperCase()}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch (err) {
    console.error("[leads] Telegram xabar xatosi:", err);
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
