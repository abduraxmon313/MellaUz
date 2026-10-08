export const locales = ["uz", "ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "uz";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export const localeNames: Record<Locale, string> = {
  uz: "O‘zbekcha",
  ru: "Русский",
  en: "English",
};

export const localeShort: Record<Locale, string> = {
  uz: "UZ",
  ru: "RU",
  en: "EN",
};

/** <html lang="..."> uchun to'liq BCP-47 kodlari */
export const htmlLang: Record<Locale, string> = {
  uz: "uz-UZ",
  ru: "ru-RU",
  en: "en-US",
};
