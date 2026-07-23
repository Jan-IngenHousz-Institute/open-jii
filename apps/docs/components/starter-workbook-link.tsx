import { PlatformLink } from "@/components/platform-link";
import { resolveStarterWorkbook } from "@/lib/starter-workbooks";
import type { ComponentProps } from "react";

type StarterWorkbookLinkProps = Omit<ComponentProps<typeof PlatformLink>, "path"> & {
  // Stable slug from lib/starter-workbooks; resolves to the environment's id.
  slug: string;
};

// Links to a recommended starter workbook for the current environment. When the
// workbook is not configured for this environment, the link becomes "Browse
// workbooks" and opens the workbook library (per the starter-workbook branch in
// the core flows) so it is never broken and never crosses environments.
export function StarterWorkbookLink({ slug, children, ...props }: StarterWorkbookLinkProps) {
  const { path, isFallback } = resolveStarterWorkbook(slug);
  return (
    <PlatformLink path={path} {...props}>
      {isFallback ? "Browse workbooks" : children}
    </PlatformLink>
  );
}
