/**
 * Default config to use when no configuration is provided
 */
export const defaultConfig = {
  spaceId: process.env.CONTENTFUL_SPACE_ID ?? "",
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN ?? "",
  previewAccessToken: process.env.CONTENTFUL_PREVIEW_ACCESS_TOKEN ?? "",
  previewSecret: process.env.CONTENTFUL_PREVIEW_SECRET ?? "",
  environment: process.env.CONTENTFUL_SPACE_ENVIRONMENT ?? "master",
};

// Export the ContentfulConfig type for use in the web app
export interface ContentfulConfig {
  spaceId: string;
  accessToken: string;
  previewAccessToken: string;
  previewSecret: string;
  environment?: string;
}
