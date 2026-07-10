import type { TagVariant } from "~/shared/ui/Tag";

/** Release-note categories, mapped to the shared Tag variants for badge colors. */
export const RELEASE_CATEGORIES = [
  "new_feature",
  "improvement",
  "bug_fix",
  "announcement",
] as const;

export type ReleaseCategory = (typeof RELEASE_CATEGORIES)[number];

interface CategoryMeta {
  /** i18n key under the `whatsNew` namespace. */
  labelKey: `category.${ReleaseCategory}`;
  tagVariant: TagVariant;
}

const CATEGORY_META: Record<ReleaseCategory, CategoryMeta> = {
  new_feature: { labelKey: "category.new_feature", tagVariant: "sensor" },
  improvement: { labelKey: "category.improvement", tagVariant: "questions" },
  bug_fix: { labelKey: "category.bug_fix", tagVariant: "default" },
  announcement: { labelKey: "category.announcement", tagVariant: "queued" },
};

/** Normalizes the free-text `category` field to known {@link CategoryMeta}; unknown → announcement. */
export function getCategoryMeta(category?: string | null): CategoryMeta {
  if (category && category in CATEGORY_META) {
    return CATEGORY_META[category as ReleaseCategory];
  }
  return CATEGORY_META.announcement;
}
