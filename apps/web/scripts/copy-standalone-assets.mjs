#!/usr/bin/env node
/**
 * `output: "standalone"` build'i `.next/static` (CSS/JS/rasmlar) va `public/`
 * papkalarini standalone serverga NUSXALAMAYDI. Ularsiz sayt dizaynsiz
 * (CSS 404) ochiladi. Bu skript build'dan keyin ularni joyiga ko'chiradi.
 *
 * Monorepo'da server shu yerda: .next/standalone/apps/web/server.js
 */
import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(appDir, ".next/standalone/apps/web");

if (!existsSync(target)) {
  console.error(`copy-standalone-assets: ${target} topilmadi (output: "standalone" yoqilganmi?)`);
  process.exit(1);
}

const copies = [
  [path.join(appDir, ".next/static"), path.join(target, ".next/static")],
  [path.join(appDir, "public"), path.join(target, "public")],
];

for (const [from, to] of copies) {
  if (!existsSync(from)) continue;
  cpSync(from, to, { recursive: true });
  console.log(`copy-standalone-assets: ${path.relative(appDir, from)} → ${path.relative(appDir, to)}`);
}
