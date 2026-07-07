/**
 * Makes a CMS link (release-note CTA, alert banner) openable by `Linking.openURL`, which needs a
 * scheme. Values with a scheme (http:, mailto:, deep links, …) pass through; a relative path is
 * joined onto the origin of `base` (only its scheme+host matter). Unchanged if there's no http(s) base.
 */
export function resolveExternalUrl(url: string, base?: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  const origin = base?.match(/^https?:\/\/[^/]+/)?.[0];
  return origin ? `${origin}/${url.replace(/^\/+/, "")}` : url;
}
