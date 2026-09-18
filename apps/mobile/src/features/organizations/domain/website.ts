import { resolveExternalUrl } from "~/shared/utils/resolve-external-url";

export interface OrganizationWebsite {
  label: string;
  href: string | null;
}

function schemeOf(url: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(url);
  return match ? match[1].toLowerCase() : null;
}

export function resolveOrganizationWebsite(
  raw: string | null | undefined,
): OrganizationWebsite | null {
  const trimmed = raw?.trim() ?? "";
  if (trimmed.length === 0) return null;

  const resolved = resolveExternalUrl(trimmed);
  const scheme = schemeOf(resolved);
  const isOpenable = scheme === "http" || scheme === "https";

  return {
    label: trimmed.replace(/^https?:\/\//i, "").replace(/\/+$/, ""),
    href: isOpenable ? resolved : null,
  };
}
