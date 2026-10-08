import type { Locale } from "./config";
import type { Dictionary } from "./locales/uz";

const loaders: Record<Locale, () => Promise<{ default: Dictionary }>> = {
  uz: () => import("./locales/uz"),
  ru: () => import("./locales/ru"),
  en: () => import("./locales/en"),
};

/** Berilgan til uchun lug'atni yuklaydi (server tomonida). */
export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const mod = await loaders[locale]();
  return mod.default;
}

export type { Dictionary };
