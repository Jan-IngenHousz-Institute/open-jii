import * as nav from "next/navigation";
import { vi } from "vitest";

/** A paginated list response holding `items`. */
export function listEnvelope(items: unknown[], page = 1, totalPages = 1) {
  return { items, page, pageSize: 20, totalPages, totalCount: items.length };
}

/** The array params as the API receives them, e.g. `family[0]=a&family[1]=b`. */
export function arrayParam(url: string, key: string): string[] {
  const params = new URL(url).searchParams;
  return [...params.keys()]
    .filter((name) => name.startsWith(`${key}[`))
    .map((name) => params.get(name) ?? "");
}

/** Opens the page on `pathname?qs`, as a shared link would. */
export function openOnUrl(pathname: string, qs: string): void {
  vi.mocked(nav.usePathname).mockReturnValue(pathname);
  vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams(qs));
}
