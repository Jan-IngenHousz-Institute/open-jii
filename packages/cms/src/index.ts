// Export types
export type { ContentfulConfig } from "./lib/types";
export type { ContentfulClients } from "./lib/client";

// Export utilities
export { createContentfulClient } from "./lib/client";
export { defaultConfig } from "./lib/types";

// Export clients for backward compatibility
export { client, previewClient } from "./lib/client";

export * from "./features/about";
export * from "./features/home";
export * from "./features/faq";
export * from "./features/policies";
export * from "./features/terms-and-conditions";
export * from "./features/footer";
