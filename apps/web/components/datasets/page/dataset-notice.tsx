"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

interface DatasetNoticeProps {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  /** Neutral for news a reader should know, amber for a page they should not cite from. */
  tone: "neutral" | "caution";
  testId: string;
}

/** A line across the dataset page about its state: a newer version, a test deposit, an embargo. */
export function DatasetNotice({ icon: Icon, title, children, tone, testId }: DatasetNoticeProps) {
  const isCaution = tone === "caution";

  return (
    <section
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        isCaution ? "bg-status-stale border-status-stale-foreground/30" : "bg-muted",
      )}
      data-testid={testId}
    >
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          isCaution ? "text-status-stale-foreground" : "text-primary",
        )}
        aria-hidden
      />
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="text-muted-foreground space-y-1 text-sm">{children}</div>
      </div>
    </section>
  );
}
