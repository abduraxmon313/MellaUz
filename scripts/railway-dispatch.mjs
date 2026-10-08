#!/usr/bin/env node
/**
 * Railway dispatcher.
 *
 * Railpack monorepo'ni repo ILDIZIDAN build qiladi va ildizdagi package.json'ning
 * `build`/`start` skriptlarini ishga tushiradi. Bu skript `RAILWAY_SERVICE_NAME`
 * bo'yicha qaysi ilovani (mella-web yoki mella-bot) build/start qilishni aniqlaydi.
 *
 * Shu tufayli Railway'da har bir service uchun qo'lda build/start buyrug'ini
 * sozlash SHART EMAS — bitta repodan ikki service to'g'ri ishlaydi.
 *
 * Ishlatish: node scripts/railway-dispatch.mjs <build|start>
 */
import { spawn } from "node:child_process";
import process from "node:process";

const task = process.argv[2];
if (task !== "build" && task !== "start") {
  console.error(`railway-dispatch: noma'lum vazifa "${task}" (build|start kutilgan)`);
  process.exit(1);
}

const serviceName = (process.env.RAILWAY_SERVICE_NAME || "").toLowerCase();
// Service nomida "bot" bo'lsa — bot; aks holda sayt (xavfsiz default).
const app = serviceName.includes("bot") ? "mella-bot" : "mella-web";

console.log(`railway-dispatch: service="${serviceName || "(aniqlanmadi)"}" → ${app} ${task}`);

let cmd;
let args;
let cwd = process.cwd();

if (task === "build") {
  cmd = "pnpm";
  args = ["--filter", app, "build"];
} else {
  // Runtime'da pnpm qatlamisiz to'g'ridan-to'g'ri ishga tushiramiz (signal/boshqaruv aniq).
  if (app === "mella-bot") {
    cmd = process.execPath;
    args = ["dist/index.js"];
    cwd = "apps/bot";
  } else {
    // standalone output mode: .next/standalone/apps/web/server.js da ishga tushadi
    cmd = process.execPath;
    args = [".next/standalone/apps/web/server.js"];
    cwd = "apps/web";
  }
}

const env = app === "mella-web"
  ? { ...process.env, HOSTNAME: "0.0.0.0" }
  : process.env;

const child = spawn(cmd, args, { stdio: "inherit", cwd, env });

const forward = (signal) => {
  try {
    child.kill(signal);
  } catch {
    /* ignore */
  }
};
process.on("SIGTERM", () => forward("SIGTERM"));
process.on("SIGINT", () => forward("SIGINT"));

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
child.on("error", (err) => {
  console.error("railway-dispatch: ishga tushirib bo'lmadi:", err);
  process.exit(1);
});
