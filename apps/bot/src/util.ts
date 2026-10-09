import { config } from "./config.js";

export function money(n: number) {
  return `${Math.round(Number(n) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${config.shop.currency}`;
}

export function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** "+998 90 123-45-67" → "+998901234567" (faqat raqam va boshidagi +). */
export function normPhone(s: string) {
  const d = String(s ?? "").replace(/[^\d+]/g, "");
  if (!d) return "";
  const digits = d.replace(/\D/g, "");
  if (digits.length === 9) return "+998" + digits;
  return "+" + digits;
}

export function isValidPhone(s: string) {
  const d = String(s ?? "").replace(/\D/g, "");
  return d.length >= 9 && d.length <= 15;
}

export function tashkentDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Asia/Tashkent",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function yandexMapUrl(lat: number, lng: number) {
  return `https://yandex.uz/maps/?pt=${lng},${lat}&z=17&l=map`;
}
