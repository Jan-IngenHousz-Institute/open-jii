// Base URL of the openJII web platform the docs link out to. Resolved per
// deployment environment (see PLATFORM_BASE_URL in deploy-docs.yml), mirroring
// DOCS_BASE_URL in ./site-url so dev docs link to the dev platform, prod to prod.
export const PLATFORM_URL = (process.env.PLATFORM_BASE_URL ?? "https://openjii.org").replace(
  /\/+$/,
  "",
);

export type PlatformEnv = "prod" | "dev";

// Which platform the docs point at, for environment-specific records (e.g.
// starter-workbook ids that differ between dev and prod). Prod is the only
// production origin; anything else (dev, staging, localhost) is treated as dev.
export const PLATFORM_ENV: PlatformEnv =
  new URL(PLATFORM_URL).hostname === "openjii.org" ? "prod" : "dev";

// Absolute platform URL for a path (leading slash optional).
export function platformUrl(path = ""): string {
  if (!path) return PLATFORM_URL;
  return `${PLATFORM_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
