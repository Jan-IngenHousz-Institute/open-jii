// Export types
export type { ContentfulConfig } from "./lib/types";
export type { ContentfulClients } from "./lib/client";

// Export utilities
export { createContentfulClient } from "./lib/client";
export { defaultConfig } from "./lib/types";

// Export clients for backward compatibility
export { client, previewClient } from "./lib/client";

export type { ComponentAlertFieldsFragment } from "./lib/__generated/sdk";
export type { PageForceUpdateFieldsFragment } from "./lib/__generated/sdk";
export type { ComponentReleaseNoteFieldsFragment } from "./lib/__generated/sdk";
export type { ComponentReleaseNoteDetailFieldsFragment } from "./lib/__generated/sdk";
