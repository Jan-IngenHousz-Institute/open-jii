"use client";

import { ExternalLink } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";

import { useWhatsNew } from "./whats-new-context";
import { WHATS_NEW_ENTRIES } from "./whats-new-entries";
import type { ReleaseNote, WhatsNewCategory } from "./whats-new-entries";

const categoryStyles: Record<WhatsNewCategory, string> = {
  new_feature:
    "bg-[hsl(180_60%_94%)] text-[hsl(180_100%_18.4%)] dark:bg-[hsl(180_30%_18%)] dark:text-[hsl(136_74%_58%)]",
  improvement: "bg-[hsl(206_77%_92%)] text-[hsl(206_40%_30%)]",
  bug_fix: "bg-muted text-muted-foreground",
  announcement: "bg-[hsl(56_100%_88%)] text-[hsl(40_60%_25%)]",
};

const categoryLabels: Record<WhatsNewCategory, string> = {
  new_feature: "New",
  improvement: "Improved",
  bug_fix: "Fixed",
  announcement: "Announcement",
};

function groupByMonth(entries: ReleaseNote[]) {
  const groups = new Map<string, ReleaseNote[]>();
  for (const entry of entries) {
    const date = new Date(entry.publishedAt);
    const label = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const existing = groups.get(label) ?? [];
    existing.push(entry);
    groups.set(label, existing);
  }
  return Array.from(groups.entries());
}

export function WhatsNewSheet() {
  const { open, setOpen } = useWhatsNew();
  const grouped = groupByMonth(WHATS_NEW_ENTRIES);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="w-full max-w-[480px] overflow-y-auto p-0 sm:max-w-[480px]"
      >
        <SheetHeader className="bg-background sticky top-0 z-10 border-b px-6 py-4">
          <SheetTitle>What's new</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-6 py-4">
          {grouped.map(([month, items]) => (
            <section key={month} className="space-y-4">
              <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                {month}
              </h3>
              {items.map((entry) => (
                <article key={entry.id} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold leading-tight">{entry.title}</h4>
                    <Badge
                      className={cn("text-[10px]", categoryStyles[entry.category])}
                      variant="outline"
                    >
                      {categoryLabels[entry.category]}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">{entry.summary}</p>
                  {entry.body && (
                    <p className="whitespace-pre-line text-sm leading-relaxed">{entry.body}</p>
                  )}
                  {entry.ctaUrl && entry.ctaLabel && (
                    <a
                      href={entry.ctaUrl}
                      className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
                    >
                      {entry.ctaLabel}
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </article>
              ))}
            </section>
          ))}
        </div>

        <div className="bg-muted/30 border-t px-6 py-3">
          <a
            href="https://openjii.org/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            Full changelog
            <ExternalLink className="size-3" />
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
