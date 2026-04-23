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
