export type WhatsNewCategory = "new_feature" | "improvement" | "bug_fix" | "announcement";

export interface ReleaseNote {
  id: string;
  title: string;
  summary: string;
  body?: string;
  category: WhatsNewCategory;
  publishedAt: string;
  ctaUrl?: string;
  ctaLabel?: string;
}

// Curated, static release notes shown in the "What's new" panel.
// TODO(OJD-1507): source these from Contentful instead of this constant.
export const WHATS_NEW_ENTRIES: ReleaseNote[] = [
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
    summary: "Long-running exports now show up in the bell, with a toast on completion.",
    body: "Start a data export, then close the modal — the bell will keep track of it for you. Status badges show running, succeeded, or failed; click through to the result. G N opens it.",
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

/** Most recent entry's publish time (ms epoch), used for the unread indicator. */
export function latestPublishedAt(): number {
  return WHATS_NEW_ENTRIES.reduce((max, e) => Math.max(max, new Date(e.publishedAt).getTime()), 0);
}
