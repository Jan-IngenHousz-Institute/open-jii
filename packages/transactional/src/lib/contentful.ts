import { createContentfulClient } from "@repo/cms/client";

export interface CmsEmail {
  internalName: string;
  preview: string;
  content: string;
}

export async function getCmsEmail(internalName: string): Promise<CmsEmail | null> {
  const { client } = createContentfulClient();
  const data = await client.componentEmailByName({ internalName });

  const item = data.componentEmailCollection?.items[0];
  if (!item?.internalName || !item.preview || !item.content) {
    console.warn(`[transactional/cms] No CMS email found for "${internalName}".`);
    return null;
  }

  return {
    internalName: item.internalName,
    preview: item.preview,
    content: item.content,
  };
}

/**
 * Replaces `{{variableName}}` placeholders in a markdown string.
 * If a variable is not found in the `vars` object, the original `{{variableName}}`
 * placeholder is preserved in the output.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}
