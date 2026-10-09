import type { Bot } from "grammy";

/**
 * Ishga tushgan bot nusxalari (aylanma import bo'lmasligi uchun alohida modul).
 *  • customer — mijoz (sotuv) boti: Mini App, buyurtma holati xabarlari.
 *  • admin    — admin boti: yangi buyurtma kartalari va holatni boshqarish.
 */
export const bots: { customer: Bot | null; admin: Bot | null } = { customer: null, admin: null };
