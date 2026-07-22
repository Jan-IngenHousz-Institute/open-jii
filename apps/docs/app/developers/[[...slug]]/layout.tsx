import { baseOptions } from "@/lib/layout.shared";
import { developersTree } from "@/lib/source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={developersTree} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
