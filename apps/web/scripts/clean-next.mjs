#!/usr/bin/env node
/**
 * Build oldidan `.next` ni tozalaydi.
 *
 * Railway (Railpack) `.next/cache` ni build'lar orasida saqlaydi. Next 16 Turbopack
 * disk keshi bilan bu holatda CSS (Tailwind `@theme` ranglari) eskicha qolib ketgan —
 * kod yangilansa ham sayt eski dizaynda chiqqan. Shuning uchun har build toza boshlanadi.
 *
 * `.next/cache` mount qilingan bo'lishi mumkin — papkaning o'zini emas, ICHINI o'chiramiz.
 */
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nextDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.next");

function clear(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === "cache" && dir === nextDir) {
      clear(p);
      continue;
    }
    try {
      rmSync(p, { recursive: true, force: true });
    } catch (e) {
      console.warn(`clean-next: ${p} o'chirilmadi: ${e.message}`);
    }
  }
}

clear(nextDir);
console.log("clean-next: .next tozalandi");
