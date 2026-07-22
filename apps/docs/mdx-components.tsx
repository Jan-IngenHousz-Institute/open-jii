import { PlatformLink } from "@/components/platform-link";
import { StarterWorkbookLink } from "@/components/starter-workbook-link";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    PlatformLink,
    StarterWorkbookLink,
    ...components,
  };
}
