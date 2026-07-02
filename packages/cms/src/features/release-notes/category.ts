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
  /** Tailwind classes for the category Badge (brand teal / sky / muted / highlight yellow). */
  badgeClassName: string;
  /** Tailwind background class for the timeline rail dot on the public /releases page. */
  dotClassName: string;
}

const CATEGORY_META: Record<ReleaseCategory, CategoryMeta> = {
  new_feature: {
    labelKey: "whatsNew.category.new_feature",
    badgeClassName: "border-transparent bg-jii-bright-green/15 text-gray-800",
    dotClassName: "bg-jii-bright-green",
  },
  improvement: {
    labelKey: "whatsNew.category.improvement",
    badgeClassName: "border-transparent bg-jii-light-blue/20 text-gray-800",
    dotClassName: "bg-jii-light-blue",
  },
  bug_fix: {
    labelKey: "whatsNew.category.bug_fix",
    badgeClassName: "border-transparent bg-muted text-muted-foreground",
    dotClassName: "bg-gray-300",
  },
  announcement: {
    labelKey: "whatsNew.category.announcement",
    badgeClassName: "border-transparent bg-highlight/40 text-gray-800",
    dotClassName: "bg-jii-light-yellow",
  },
};

/** Normalizes the free-text `category` field to known {@link CategoryMeta}; unknown → announcement. */
export function getCategoryMeta(category?: string | null): CategoryMeta {
  if (category && category in CATEGORY_META) {
    return CATEGORY_META[category as ReleaseCategory];
  }
  return CATEGORY_META.announcement;
}
