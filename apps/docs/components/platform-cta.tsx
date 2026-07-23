import { PlatformLink } from "@/components/platform-link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

interface PlatformCtaProps {
  // Platform path the action opens, e.g. "/en-US/platform/experiments/new".
  path: string;
  children: ReactNode;
}

// Prominent "do this in openJII" call to action for task guide pages. Resolves
// the platform origin per environment and opens in a new tab via PlatformLink.
// Use at most one primary CTA per page. Registered globally in mdx-components.tsx.
export function PlatformCta({ path, children }: PlatformCtaProps) {
  return (
    <PlatformLink
      path={path}
      className="bg-fd-primary text-fd-primary-foreground my-6 inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold no-underline transition-opacity hover:opacity-90"
    >
      {children}
      <ArrowUpRight className="size-4" aria-hidden />
      <span className="sr-only"> (opens in a new tab)</span>
    </PlatformLink>
  );
}
