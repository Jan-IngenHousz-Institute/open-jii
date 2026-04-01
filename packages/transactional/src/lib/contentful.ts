import { createContentfulClient } from "@repo/cms/client";
import type { ComponentEmailFieldsFragment } from "@repo/cms/lib/__generated/sdk";

export interface CmsEmail {
  internalName: string;
  preview: string;
  content: string;
}

export async function getCmsEmails(usePreview = false): Promise<CmsEmail[]> {
  const { client, previewClient } = createContentfulClient();
  const sdk = usePreview ? previewClient : client;
  const data = await sdk.pageEmails({ preview: usePreview });

  const items: (ComponentEmailFieldsFragment | null)[] =
    data.pageEmailsCollection?.items[0]?.emailsCollection?.items ?? [];

  return items.reduce<CmsEmail[]>((acc, item) => {
    if (item?.internalName && item.preview && item.content) {
      acc.push({
        internalName: item.internalName,
        preview: item.preview,
        content: item.content,
      });
    }
    return acc;
  }, []);
}

export async function getCmsEmail(
  internalName: string,
  usePreview = false,
): Promise<CmsEmail | null> {
  const emails = await getCmsEmails(usePreview);
  const found = emails.find((e) => e.internalName === internalName) ?? null;
  if (!found) {
    console.warn(
      `[transactional/cms] No CMS email found for "${internalName}". Available: [${emails.map((e) => e.internalName).join(", ")}].`,
    );
  }
  return found;
}

/**
 * Replaces `{{variableName}}` placeholders in a markdown string.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}
