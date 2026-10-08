import type { Locale } from "@/i18n/config";

const localeTag: Record<Locale, string> = {
  uz: "uz-UZ",
  ru: "ru-RU",
  en: "en-US",
};

/** Narxni mahalliy ko'rinishda formatlaydi (bo'sh joy bilan ajratilgan). */
export function formatPrice(amount: number, locale: Locale): string {
  try {
    return new Intl.NumberFormat(localeTag[locale]).format(amount);
  } catch {
    return String(amount);
  }
}
