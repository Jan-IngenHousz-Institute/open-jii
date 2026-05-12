"use client";

import { ExternalLink } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";

import { useWhatsNew } from "./whats-new-context";

type Category = "new_feature" | "improvement" | "bug_fix" | "announcement";

interface ReleaseNote {
  id: string;
  title: string;
  summary: string;
  body?: string;
  category: Category;
  publishedAt: string;
  ctaUrl?: string;
  ctaLabel?: string;
}

// Mock data — replace with Contentful-fed entries in the OJD-1507 implementation.
const MOCK_ENTRIES: ReleaseNote[] = [
  {
    id: "chrome-refresh-1",
    title: "Resizable, collapsible sidebar",
    summary: "Drag the sidebar edge to set its width, or press ⌘ B to fully collapse it.",
    body: "Drag the right edge to resize between 220 and 360 px. Double-click the rail or press ⌘ B to fully collapse — a small re-open button appears in the top-left. Your width and collapse state are remembered across reloads.",
    category: "new_feature",
    publishedAt: "2026-05-12",
    ctaLabel: "Open settings",
    ctaUrl: "/platform/account/settings",
  },
  {
    id: "chrome-refresh-2",
    title: "Linear-style keyboard shortcuts",
    summary: "Press G then a letter to jump anywhere. Press ? to see the full list.",
    body: "Press G then E for Experiments, G W for Workbooks, G S for Settings, and so on. ⌘ K opens a fuzzy command palette with pages and actions. ? opens a cheatsheet listing everything available.",
    category: "new_feature",
    publishedAt: "2026-05-12",
  },
  {
    id: "chrome-refresh-3",
    title: "Activity hub in the topbar",
    summary: "Long-running exports and Ambyte uploads now show up in the bell, with a toast on completion.",
    body: "Start a data export or an Ambyte upload, then close the modal — the bell will keep track of it for you. Status badges show running, succeeded, or failed; click through to the result. G N opens it.",
    category: "new_feature",
    publishedAt: "2026-05-12",
  },
  {
    id: "may-improvements",
    title: "May improvements & fixes",
    summary: "Big-screen breakpoints, slimmer topbar, and a handful of paper cuts.",
    body: `- Added 3xl (1920 px) and 4xl (2560 px) breakpoints. Data-heavy views (experiments, workbooks, data tab) now fill the viewport on big monitors.
- Settings, create-experiment, and create-macro forms keep a comfortable reading width even at 2560 px.
- Topbar slimmed from 64 to 48 px. Workspace and account moved to the sidebar header / footer.
- "What's new" added to the sidebar footer with an unread dot — that's what you're reading right now.
- ⌘ B (sidebar toggle) keeps working; existing keyboard shortcut is unchanged.`,
    category: "improvement",
    publishedAt: "2026-05-08",
  },
  {
    id: "may-fixes",
    title: "Bug fixes",
    summary: "Smaller paper cuts cleared out in the May polish pass.",
    body: `- Fixed an issue where the breadcrumb on data-heavy pages was offset from the table content.
- Visualization workspace no longer caps width on 1920 px+ monitors.
- The sidebar toggle button no longer disappears momentarily during the collapse animation.
- Mobile drawer keeps its scroll position when reopened.`,
    category: "bug_fix",
    publishedAt: "2026-05-08",
  },
  {
    id: "april-multispeq",
    title: "MultispeQ timeseries chart",
    summary: "Plot Si traces over time directly in the visualization workspace.",
    body: "The visualization workspace now supports timeseries charts for MultispeQ measurements. Pick the timeseries family, configure the Si and color encoding, and the chart streams in as data lands.",
    category: "new_feature",
    publishedAt: "2026-04-22",
    ctaLabel: "Open visualizations",
    ctaUrl: "/platform/experiments",
  },
  {
    id: "april-improvements",
    title: "April improvements",
    summary: "Notebook foundation, macro sandbox, and a faster export pipeline.",
    body: `- Notebook framework foundation merged (OJD-589). Cell types coming in the next few weeks.
- Macro execution moved to a dedicated Firecracker Lambda sandbox. Faster cold-starts, stricter isolation.
- Data export pipeline now polls Databricks every 15 s and surfaces the run id, paving the way for the activity hub.
- Improved error messages when a transfer request fails partway through.`,
    category: "improvement",
    publishedAt: "2026-04-15",
  },
];

const categoryStyles: Record<Category, string> = {
  new_feature: "bg-[hsl(180_60%_94%)] text-[hsl(180_100%_18.4%)] dark:bg-[hsl(180_30%_18%)] dark:text-[hsl(136_74%_58%)]",
  improvement: "bg-[hsl(206_77%_92%)] text-[hsl(206_40%_30%)]",
  bug_fix: "bg-muted text-muted-foreground",
  announcement: "bg-[hsl(56_100%_88%)] text-[hsl(40_60%_25%)]",
};

const categoryLabels: Record<Category, string> = {
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
  const grouped = groupByMonth(MOCK_ENTRIES);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full max-w-[480px] overflow-y-auto p-0 sm:max-w-[480px]">
        <SheetHeader className="sticky top-0 z-10 border-b bg-background px-6 py-4">
          <SheetTitle>What's new</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-6 py-4">
          {grouped.map(([month, items]) => (
            <section key={month} className="space-y-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {month}
              </h3>
              {items.map((entry) => (
                <article key={entry.id} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold leading-tight">{entry.title}</h4>
                    <Badge className={cn("text-[10px]", categoryStyles[entry.category])} variant="outline">
                      {categoryLabels[entry.category]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{entry.summary}</p>
                  {entry.body && (
                    <p className="whitespace-pre-line text-sm leading-relaxed">{entry.body}</p>
                  )}
                  {entry.ctaUrl && entry.ctaLabel && (
                    <a
                      href={entry.ctaUrl}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
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

        <div className="border-t bg-muted/30 px-6 py-3">
          <a
            href="https://openjii.org/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Full changelog
            <ExternalLink className="size-3" />
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
