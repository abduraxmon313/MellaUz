import { fileURLToPath } from "node:url";
import path from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { webhookCallback } from "grammy";
import { config, hasAdminBot, hasBillz, hasBot } from "./config.js";
import { createBot, setupWebhook } from "./bot.js";
import { adminFallbackComposer, createAdminBot, setupAdminWebhook } from "./admin/bot.js";
import { bots } from "./telegram.js";
import { store } from "./store.js";
import { catalogStatus, initCatalog } from "./catalog/index.js";
import { registerApi } from "./api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/ dan ishga tushganda public/ bir pog'ona yuqorida bo'ladi
const PUBLIC_DIR = path.resolve(__dirname, "../public");

export async function buildServer() {
  const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 256 * 1024 });

  app.get("/health", async () => ({
    status: "ok",
    service: "mella-bot",
    bot: hasBot ? "configured" : "disabled",
    admin_bot: hasAdminBot ? "configured" : "disabled",
    db: store.kind,
    billz: hasBillz ? "configured" : "disabled",
    catalog: catalogStatus(),
  }));

  const adminBot = createAdminBot();
  // Admin bot yo'q bo'lsa — kartalar mijoz boti orqali, tugmalar ham shu yerda ishlaydi.
  const bot = createBot(adminBot ? undefined : adminFallbackComposer());
  bots.customer = bot;
  bots.admin = adminBot;

  if (bot) {
    app.post(
      `/webhook/${config.webhookSecret}`,
      webhookCallback(bot, "fastify", { secretToken: config.webhookSecret }),
    );
  }
  if (adminBot) {
    app.post(
      `/webhook-admin/${config.webhookSecret}`,
      webhookCallback(adminBot, "fastify", { secretToken: config.webhookSecret }),
    );
  }

  await registerApi(app);

  // Mini App statik fayllari. index.html keshlanmaydi (yangi versiya darhol chiqsin),
  // JS/CSS esa ?v= bilan versiyalanadi.
  await app.register(fastifyStatic, {
    root: PUBLIC_DIR,
    prefix: "/",
    index: ["index.html"],
    cacheControl: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) res.header("cache-control", "no-cache");
      else if (/\/images\//.test(filePath)) res.header("cache-control", "public, max-age=604800");
      else res.header("cache-control", "public, max-age=3600");
    },
  });

  return { app, bot, adminBot };
}

export async function start() {
  await store.init();
  console.log(`[store] ${store.kind}${store.kind === "memory" ? " (DATABASE_URL yo'q — ma'lumotlar saqlanmaydi!)" : ""}`);
  await initCatalog();

  const { app, bot, adminBot } = await buildServer();
  if (bot) await bot.init();
  if (adminBot) await adminBot.init();

  await app.listen({ port: config.port, host: config.host });
  app.log.info(`MELLA bot server :${config.port} da ishga tushdi`);

  if (bot) {
    await setupWebhook(bot).catch((err) => app.log.error({ err }, "webhook o'rnatishda xato"));
  } else {
    app.log.warn("BOT_CUSTOMER_TOKEN yo'q — faqat Mini App va /health ishlaydi.");
  }
  if (adminBot) {
    await setupAdminWebhook(adminBot).catch((err) => app.log.error({ err }, "admin webhook xato"));
  }
  if (!config.adminIds.length) app.log.warn("ADMIN_IDS bo'sh — buyurtmalar adminlarga yuborilmaydi!");

  const shutdown = async () => {
    app.log.info("to'xtatilmoqda…");
    await app.close();
    await store.close().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
