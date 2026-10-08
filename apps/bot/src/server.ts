import { fileURLToPath } from "node:url";
import path from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { webhookCallback } from "grammy";
import { config, hasBot } from "./config.js";
import { createBot, setupWebhook } from "./bot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/ dan ishga tushganda public/ bir pog'ona yuqorida bo'ladi
const PUBLIC_DIR = path.resolve(__dirname, "../public");

export async function buildServer() {
  const app = Fastify({ logger: true, trustProxy: true });

  app.get("/health", async () => ({
    status: "ok",
    service: "mella-bot",
    bot: hasBot ? "configured" : "disabled",
  }));

  const bot = createBot();

  if (bot) {
    // Telegram webhook endpoint (secret yo'l + header tekshiruvi grammY ichida)
    app.post(`/webhook/${config.webhookSecret}`, webhookCallback(bot, "fastify"));
  }

  // Mini App statik fayllari
  await app.register(fastifyStatic, {
    root: PUBLIC_DIR,
    prefix: "/",
    index: ["index.html"],
    cacheControl: true,
    maxAge: "1h",
  });

  return { app, bot };
}

export async function start() {
  const { app, bot } = await buildServer();

  await app.listen({ port: config.port, host: config.host });
  app.log.info(`MELLA bot server :${config.port} da ishga tushdi`);

  if (bot) {
    try {
      await setupWebhook(bot);
    } catch (err) {
      app.log.error({ err }, "webhook o'rnatishda xato");
    }
  } else {
    app.log.warn("BOT_CUSTOMER_TOKEN yo'q — faqat Mini App va /health ishlaydi.");
  }

  const shutdown = async () => {
    app.log.info("to'xtatilmoqda…");
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
