"use client";

import { dynamicCommandIssueKey } from "@/lib/workbook/dynamic-command-authoring";
import type { StructuralIssue } from "@/lib/workbook/publish-error";
import { AlertTriangle } from "lucide-react";
import NextLink from "next/link";

import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

interface StructuralIssueListProps {
  /** Allowlisted, already-projected issues (never raw server details). */
  issues: StructuralIssue[];
  /** When set, renders a link to open the workbook so the author can repair it. */
  workbookId?: string;
  locale?: string;
  className?: string;
}

/**
 * Shared repair surface for a rejected structural attach/publish. Lists each
 * issue keyed by its `commandCellId` with translated guidance and, when a
 * workbook is known, a link to open it. Renders only the projected fields.
 */
export function StructuralIssueList({
  issues,
  workbookId,
  locale,
  className,
}: StructuralIssueListProps) {
  const { t } = useTranslation(["experiments", "workbook"]);
  return (
    <div
      data-testid="structural-issues"
      // Inserted asynchronously after a failed mutation: announce it atomically
      // so keyboard/screen-reader users learn the attach failed and repair
      // guidance appeared without moving focus off the trigger.
      role="alert"
      aria-atomic="true"
      className={cn("rounded-md border border-red-200 bg-red-50 p-2.5 text-red-800", className)}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t("flow.structuralAttach.title")}
      </div>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs">
        {issues.map((issue, i) => (
          <li key={`${issue.commandCellId}-${issue.code}-${i}`}>
            <span className="font-mono">{issue.commandCellId}</span>:{" "}
            {t(dynamicCommandIssueKey(issue.code), { ns: "workbook" })}
          </li>
        ))}
      </ul>
      {workbookId && locale ? (
        <NextLink
          href={`/${locale}/platform/workbooks/${workbookId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-block text-xs font-medium underline"
        >
          {t("flow.structuralAttach.openWorkbook")}
        </NextLink>
      ) : null}
    </div>
  );
}
