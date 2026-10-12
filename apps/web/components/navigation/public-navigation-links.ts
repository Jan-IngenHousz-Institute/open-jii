import { isKnownLocale } from "@repo/i18n/config";

export interface PublicNavigationLink {
  id: string;
  label: string;
  href: string;
}

export function publicNavigationHref(value: string, locale: string): string | null {
  const url = value.trim();
  if (!url || [...url].some((character) => character.charCodeAt(0) <= 32 || character === "\\"))
    return null;

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      return parsed.username || parsed.password ? null : parsed.href;
    } catch {
      return null;
    }
  }

  if (!url.startsWith("/") || url.startsWith("//")) return null;
  const parsed = new URL(url, "https://openjii.org");
  const firstSegment = parsed.pathname.split("/")[1];
  const path = isKnownLocale(firstSegment)
    ? parsed.pathname
    : `/${locale}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  return `${path}${parsed.search}${parsed.hash}`;
}

export function isPublicNavigationLinkActive(href: string, pathname: string, locale: string) {
  if (!href.startsWith("/") || href.includes("#")) return false;
  const path = href.split("?")[0].replace(/\/$/, "");
  const current = pathname.replace(/\/$/, "");
  if (path === `/${locale}`) return current === path;
  if (path === `/${locale}/platform`) {
    const authRoutes = ["login", "login-error", "register", "verify-request"];
    if (authRoutes.some((route) => current === `/${locale}/${route}`)) return true;
    if (current === "/api/auth/verify-request") return true;
  }
  return current === path || current.startsWith(`${path}/`);
}
