import { PlatformLink } from "@/components/platform-link";
import { starterWorkbookPath } from "@/lib/starter-workbooks";
import type { ComponentProps } from "react";

type StarterWorkbookLinkProps = Omit<ComponentProps<typeof PlatformLink>, "path"> & {
  // Stable slug from lib/starter-workbooks; resolves to the environment's id.
  slug: string;
};

// Links to a recommended starter workbook, resolving the environment-specific
// id and platform origin. Registered globally in mdx-components.tsx.
export function StarterWorkbookLink({ slug, ...props }: StarterWorkbookLinkProps) {
  return <PlatformLink path={starterWorkbookPath(slug)} {...props} />;
}
