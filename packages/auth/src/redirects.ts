// Dev and local session cookies never reach production Equipment, so they return to a local one.
const siblingAppOrigins: Record<string, readonly string[]> = {
  prod: ["https://equipment.openjii.org"],
  dev: ["http://localhost:3100"],
  local: ["http://localhost:3100"],
};

export function getSiblingAppOrigins(environment: string): readonly string[] {
  return siblingAppOrigins[environment] ?? [];
}

export function resolveAuthCallback(
  callbackUrl: string | undefined,
  { baseUrl, environment }: { baseUrl: string; environment: string },
): string {
  const fallback = "/platform";
  if (!callbackUrl || callbackUrl.includes("\\")) return fallback;
  if ([...callbackUrl].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) {
    return fallback;
  }
  if (callbackUrl.startsWith("//")) return fallback;

  try {
    const base = new URL(baseUrl);
    const url = new URL(callbackUrl, base);
    if (url.username || url.password) return fallback;
    if (!["http:", "https:"].includes(url.protocol)) return fallback;
    if (url.origin !== base.origin && !getSiblingAppOrigins(environment).includes(url.origin)) {
      return fallback;
    }
    if (url.origin === base.origin && url.pathname.startsWith("//")) return fallback;
    if (callbackUrl.startsWith("/")) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    if (!/^https?:\/\//i.test(callbackUrl)) return fallback;
    return url.href;
  } catch {
    return fallback;
  }
}
