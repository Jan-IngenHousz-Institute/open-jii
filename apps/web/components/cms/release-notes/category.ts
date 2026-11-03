/**
 * Release-note categories. The CMS field is free-text (a single-select enum in
 * Contentful, but typed as `string` here), so we normalize to a known category and fall back
 * gracefully. Mirrors the alert feature's severity.ts.
 */
export const RELEASE_CATEGORIES = [
  "new_feature",
  "improvement",
  "bug_fix",
  "announcement",
] as const;

export type ReleaseCategory = (typeof RELEASE_CATEGORIES)[number];

export interface CategoryMeta {
  /** i18n key under the `navigation` namespace. */
  labelKey: `whatsNew.category.${ReleaseCategory}`;
  /** Tailwind classes for the category Badge, on the `--status-*` tokens. */
  badgeClassName: string;
  /** Tailwind background class for the timeline rail dot on the public /releases page. */
  dotClassName: string;
}

const CATEGORY_META: Record<ReleaseCategory, CategoryMeta> = {
  new_feature: {
    labelKey: "whatsNew.category.new_feature",
    badgeClassName: "border-transparent bg-status-active text-status-active-foreground",
    dotClassName: "bg-status-active-foreground",
  },
  improvement: {
    labelKey: "whatsNew.category.improvement",
    badgeClassName: "border-transparent bg-status-published text-status-published-foreground",
    dotClassName: "bg-status-published-foreground",
  },
  bug_fix: {
    labelKey: "whatsNew.category.bug_fix",
    badgeClassName: "border-transparent bg-status-archived text-status-archived-foreground",
    dotClassName: "bg-status-archived-foreground",
  },
  announcement: {
    labelKey: "whatsNew.category.announcement",
    badgeClassName: "border-transparent bg-status-stale text-status-stale-foreground",
    dotClassName: "bg-status-stale-foreground",
  },
};

/** Normalizes the free-text `category` field to a known {@link ReleaseCategory}; unknown → announcement. */
export function normalizeCategory(category?: string | null): ReleaseCategory {
  if (category && category in CATEGORY_META) {
    return category as ReleaseCategory;
  }
  return "announcement";
}

/** Resolves the free-text `category` field to its {@link CategoryMeta}; unknown → announcement. */
export function getCategoryMeta(category?: string | null): CategoryMeta {
  return CATEGORY_META[normalizeCategory(category)];
}
