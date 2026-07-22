"use client";

import { ExternalLink, HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import { env } from "~/env";

import { useTranslation } from "@repo/i18n";

interface DocsHelpLinkProps {
  // Documentation path, e.g. "/guide/experiments/creating".
  path: string;
  // Optional label; defaults to the shared "Learn how" string.
  label?: ReactNode;
  // Render a compact help icon instead of a text link (for tight toolbars).
  iconOnly?: boolean;
  className?: string;
}

// Small contextual link to a documentation page. Resolves the docs base URL for
// the current environment and opens in a new tab, so high-friction platform
// surfaces just pass a doc path.
export function DocsHelpLink({ path, label, iconOnly = false, className }: DocsHelpLinkProps) {
  const { t } = useTranslation("common");
  const href = `${env.NEXT_PUBLIC_DOCS_URL}${path}`;
  const text = label ?? t("docsHelp.learnHow");

  if (iconOnly) {
    const accessibleName = typeof text === "string" ? text : undefined;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={accessibleName}
        aria-label={accessibleName}
        className={`text-muted-foreground hover:text-foreground inline-flex items-center ${className ?? ""}`}
      >
        <HelpCircle className="size-4" aria-hidden />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline ${className ?? ""}`}
    >
      {text}
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}
