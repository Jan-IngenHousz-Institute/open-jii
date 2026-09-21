export function resolveAssistantSourceLink(
  url: string,
  docsOrigin: string,
  platformOrigin?: string,
): string {
  let candidate = url;
  if (/^https?:\/\//iu.test(url)) {
    if (!URL.canParse(url)) return url;
    const absolute = new URL(url);
    // Older answers expanded /docs citations against the public platform origin.
    const legacyOrigins = ["https://openjii.org", platformOrigin && new URL(platformOrigin).origin];
    if (!legacyOrigins.includes(absolute.origin) || !absolute.pathname.startsWith("/docs/"))
      return url;
    candidate = `${absolute.pathname}${absolute.search}${absolute.hash}`;
  }
  const match = /^(?:\/docs)?(\/(?:guide|developers|api)(?:\/[^?#]*)?)([?#].*)?$/u.exec(candidate);
  const pathname = match?.at(1);
  if (!pathname) return url;
  const route = pathname
    .replace(/\.mdx?$/u, "")
    .replace(/\/index\/?$/u, "")
    .replace(/\/$/u, "");
  return new URL(`${route}${match?.at(2) ?? ""}`, new URL(docsOrigin).origin).href;
}
