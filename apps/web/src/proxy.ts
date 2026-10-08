import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, locales } from "@/i18n/config";

const PUBLIC_FILE = /\.[^/]+$/;

/** Accept-Language sarlavhasidan qo'llab-quvvatlanadigan tilni tanlaydi. */
function detectLocale(req: NextRequest): string {
  const header = req.headers.get("accept-language");
  if (!header) return defaultLocale;
  const wanted = header
    .split(",")
    .map((part) => part.split(";")[0]!.trim().slice(0, 2).toLowerCase());
  for (const code of wanted) {
    if (isLocale(code)) return code;
  }
  return defaultLocale;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API, Next ichki yo'llari, statik fayllar — tegmaymiz
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Allaqachon til prefiksi bormi?
  const hasLocale = locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  if (hasLocale) return NextResponse.next();

  // Til prefiksi yo'q — mos tilga yo'naltiramiz
  const locale = detectLocale(req);
  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|api|images|.*\\..*).*)"],
};
