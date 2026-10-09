import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { config } from "./config.js";

/**
 * Telegram Mini App `initData` imzosini tekshirish.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * secret = HMAC_SHA256(key="WebAppData", bot_token)
 * hash   = HMAC_SHA256(key=secret, data_check_string)
 *
 * Mini App mijoz botidan ham, admin botdan ham ochilishi mumkin — ikkala token bilan sinaymiz.
 */

export interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export class AuthError extends Error {
  statusCode = 401;
}

function hashFor(pairs: [string, string][], token: string) {
  const dcs = pairs
    .slice()
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  return createHmac("sha256", secret).update(dcs).digest("hex");
}

export function verifyInitData(initData: string): TgUser | null {
  if (!initData) return null;
  const tokens = [config.botToken, config.adminBotToken].filter(Boolean);
  if (!tokens.length) return null;

  const params = new URLSearchParams(initData);
  const received = params.get("hash");
  if (!received) return null;
  const pairs = [...params.entries()].filter(([k]) => k !== "hash");

  const authDate = Number(params.get("auth_date") || 0);
  if (config.initDataMaxAge > 0 && authDate && Date.now() / 1000 - authDate > config.initDataMaxAge) return null;

  // Bot API 8.0+ `signature` maydoni bilan ham, usiz ham sinaymiz (mijoz versiyalari farqi).
  const variants = [pairs];
  if (pairs.some(([k]) => k === "signature")) variants.push(pairs.filter(([k]) => k !== "signature"));

  const recv = Buffer.from(received, "hex");
  for (const token of tokens) {
    for (const v of variants) {
      const calc = Buffer.from(hashFor(v, token), "hex");
      if (calc.length === recv.length && timingSafeEqual(calc, recv)) {
        try {
          const user = JSON.parse(params.get("user") || "null") as TgUser | null;
          return user && user.id ? user : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** So'rovdan initData olib, foydalanuvchini qaytaradi; bo'lmasa 401. */
export function requireUser(req: FastifyRequest): TgUser {
  const q = req.query as Record<string, string | undefined>;
  const raw = (req.headers["x-telegram-init-data"] as string | undefined) || q.tgWebAppData || "";
  const user = verifyInitData(raw);
  if (user) return user;

  // Lokal ishlab chiqish: bot tokeni umuman yo'q bo'lsa, demo foydalanuvchi.
  if (!config.botToken && !config.adminBotToken && process.env.NODE_ENV !== "production") {
    return { id: 1, first_name: "Demo" };
  }
  throw new AuthError("Tasdiqlanmagan so'rov. Do'konni Telegram bot orqali oching.");
}
