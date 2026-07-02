// Export types
export type { ContentfulConfig } from "./lib/types";
export type { ContentfulClients } from "./lib/client";

// Export utilities
export { createContentfulClient } from "./lib/client";
export { defaultConfig } from "./lib/types";

// Export clients for backward compatibility
export { client, previewClient } from "./lib/client";

export { AboutContent } from "./features/about";
export { HomeHero } from "./features/home/hero";
export { HomeAboutMission } from "./features/home/mission";
export { HomeKeyFeatures } from "./features/home/key-features";
export { HomePartners } from "./features/home/partners";
export { FaqContent } from "./features/faq";
export { PoliciesContent } from "./features/policies";
export { CookiePolicyContent } from "./features/cookie-policy";
export {
  TermsAndConditionsContent,
  TermsAndConditionsTitle,
  TermsAndConditionsPage,
} from "./features/terms-and-conditions";
export { HomeFooter } from "./features/footer";
export { AlertsContainer } from "./features/alert/alerts-container";
export type { ComponentAlertFieldsFragment } from "./lib/__generated/sdk";
export type { PageForceUpdateFieldsFragment } from "./lib/__generated/sdk";

// What's new / release notes + public /releases page (OJD-1394)
export { ReleaseNotesFeed } from "./features/release-notes/release-notes-feed";
export { ReleaseNoteEntry } from "./features/release-notes/release-note-entry";
export { ReleaseNoteArticle } from "./features/release-notes/release-note-article";
export { ReleaseHero } from "./features/release-notes/release-hero";
export type { ComponentReleaseNoteFieldsFragment } from "./lib/__generated/sdk";
export {
  getCategoryMeta,
  RELEASE_CATEGORIES,
  type ReleaseCategory,
  type CategoryMeta,
} from "./features/release-notes/category";
