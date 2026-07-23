import { platformUrl } from "@/lib/platform-url";
import Link from "fumadocs-core/link";
import type { ComponentProps } from "react";

type PlatformLinkProps = Omit<ComponentProps<typeof Link>, "href" | "target" | "rel"> & {
  // Path on the openJII platform, e.g. "/releases". Resolved against the
  // environment-specific platform base URL so dev docs point at the dev platform.
  path: string;
};

// Renders like a normal MDX link (Fumadocs Link) but targets the platform base
// URL for the current environment. Registered globally in mdx-components.tsx so
// content can use <PlatformLink path="..."> without importing anything.
export function PlatformLink({ path, ...props }: PlatformLinkProps) {
  // Enforced attributes come after the spread so callers cannot override the
  // environment-aware href or the new-tab / opener-protection attributes.
  // Cross-origin by construction (platform vs docs host), so this always opens a
  // new tab rather than relying on Fumadocs' external-link detection.
  return <Link {...props} href={platformUrl(path)} target="_blank" rel="noopener noreferrer" />;
}
