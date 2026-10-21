import { render } from "@react-email/components";

import { Email } from "../emails/email";
import { ResourceDeletedNotification } from "../emails/fallbacks/resource-deleted-notification";
import { getCmsEmail } from "../lib/contentful";

export interface RenderResourceDeletedNotificationParams {
  host: string;
  baseUrl: string;
  resourceKind: string;
  resourceName: string;
  actor: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderResourceDeletedNotification(
  params: RenderResourceDeletedNotificationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, resourceKind, resourceName, actor } = params;

  const emailData = await getCmsEmail("resource-deleted-notification", {
    host,
    baseUrl,
    resourceKind,
    resourceName,
    actor,
  });

  if (!emailData) {
    const html = await render(
      ResourceDeletedNotification({ host, baseUrl, resourceKind, resourceName, actor }),
      {},
    );
    const text = await render(
      ResourceDeletedNotification({ host, baseUrl, resourceKind, resourceName, actor }),
      { plainText: true },
    );
    return { html, text, preview: `${resourceName} was deleted on openJII` };
  }

  const html = await render(
    Email({
      host,
      baseUrl,
      cmsPreview: emailData.preview,
      cmsContent: emailData.content,
    }),
    {},
  );

  const text = await render(
    Email({
      host,
      baseUrl,
      cmsPreview: emailData.preview,
      cmsContent: emailData.content,
    }),
    { plainText: true },
  );

  return { html, text, preview: emailData.preview };
}
