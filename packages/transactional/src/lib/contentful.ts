import type { Document } from "@contentful/rich-text-types";

import { createContentfulClient } from "@repo/cms/client";

import type { EmailRichTextInterface } from "../components/ctf-rich-text";

/**
 * Each value must match the `internalName` of a `ComponentEmail` entry in Contentful.
 * Before adding a new email here, create the corresponding entry in Contentful first.
 */
export type CmsEmailType =
  | "added-user-notification"
  | "otp-email"
  | "project-transfer-complete"
  | "transfer-request-confirmation";

export interface CmsEmail {
  internalName: string;
  preview: string;
  content: EmailRichTextInterface;
}

export async function getCmsEmail(
  internalName: CmsEmailType,
  variables?: Record<string, string>,
): Promise<CmsEmail | null> {
  const { client } = createContentfulClient();
  const data = await client.componentEmailByName({ internalName });

  const item = data.componentEmailCollection?.items[0];
  if (!item?.internalName || !item.preview || !item.content?.json) {
    console.warn(`[transactional/cms] No CMS email found for "${internalName}".`);
    return null;
  }

  const rawLinks = item.content.links as CmsEmail["content"]["links"];

  const preview = variables ? interpolate(item.preview, variables) : item.preview;
  const json = variables
    ? interpolate(item.content.json as Document, variables)
    : (item.content.json as Document);

  const links = variables && rawLinks ? interpolate(rawLinks, variables) : rawLinks;

  return {
    internalName: item.internalName,
    preview,
    content: {
      json,
      links,
    },
  };

  /**
   * Replaces `{{variableName}}` placeholders in contentful fields.
   * If a variable is not found in the `vars` object, the original `{{variableName}}`
   * placeholder is preserved in the output.
   */
  function interpolate<T>(value: T, vars: Record<string, string>): T {
    return JSON.parse(
      JSON.stringify(value, (_key, val: unknown) => {
        if (typeof val === "string") {
          return val.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
        }
        return val;
      }),
    ) as T;
  }
}
