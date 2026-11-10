import type { Document } from "@contentful/rich-text-types";

import { createContentfulClient } from "@repo/cms/client";

import { VARIABLE_LIST_ITEM } from "../components/ctf-rich-text";
import type { EmailRichTextInterface } from "../components/ctf-rich-text";

/**
 * Each value must match the `internalName` of a `ComponentEmail` entry in Contentful.
 * Before adding a new email here, create the corresponding entry in Contentful first.
 */
export type CmsEmailType =
  | "access-granted-notification"
  | "api-key-created-notification"
  | "experiment-made-public-notification"
  | "otp-email"
  | "passkey-added-notification"
  | "passkey-added-unnamed-notification"
  | "project-transfer-complete"
  | "transfer-request-confirmation"
  | "join-request-submitted"
  | "join-request-rejected"
  | "organization-invitation"
  | "organization-join-request-submitted"
  | "organization-join-request-approved"
  | "organization-join-request-rejected"
  | "resource-deleted-notification"
  | "organization-role-changed"
  | "organization-membership-removed"
  | "calibration-run-awaiting-approval-notification"
  | "calibration-run-approved-notification"
  | "calibration-run-rejected-notification"
  | "data-upload-completed-notification"
  | "data-upload-failed-notification"
  | "data-upload-partly-completed-notification";

export interface CmsEmail {
  internalName: string;
  preview: string;
  content: EmailRichTextInterface;
}

export async function getCmsEmail(
  internalName: CmsEmailType,
  variables?: Record<string, string | string[]>,
): Promise<CmsEmail | null> {
  const { client } = createContentfulClient();
  const data = await client.componentEmailByName({ internalName });

  const item = data.componentEmailCollection?.items[0];
  if (!item?.internalName || !item.preview || !item.content?.json) {
    console.warn(`[transactional/cms] No CMS email found for "${internalName}".`);
    return null;
  }

  const rawLinks = item.content.links as CmsEmail["content"]["links"];

  const inline = (items: string[]) => items.join(", ");
  const preview = variables ? interpolate(item.preview, variables, inline) : item.preview;
  const json = variables
    ? interpolate(item.content.json as Document, variables, (items) =>
        items.map((entry) => `${VARIABLE_LIST_ITEM}${entry}`).join(""),
      )
    : (item.content.json as Document);

  const links = variables && rawLinks ? interpolate(rawLinks, variables, inline) : rawLinks;

  return {
    internalName: item.internalName,
    preview,
    content: {
      json,
      links,
    },
  };

  /**
   * Replaces `{{variableName}}` placeholders in contentful fields; a list variable is written
   * out by `list`. If a variable is not found in the `vars` object, the original
   * `{{variableName}}` placeholder is preserved in the output.
   */
  function interpolate<T>(
    value: T,
    vars: Record<string, string | string[]>,
    list: (items: string[]) => string,
  ): T {
    return JSON.parse(
      JSON.stringify(value, (_key, val: unknown) => {
        if (typeof val === "string") {
          return val.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
            const v = vars[k];
            if (v === undefined) return `{{${k}}}`;
            return Array.isArray(v) ? list(v) : v;
          });
        }
        return val;
      }),
    ) as T;
  }
}
