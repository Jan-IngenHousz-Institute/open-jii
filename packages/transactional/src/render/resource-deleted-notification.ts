import { render } from "@react-email/components";

import type { EmailUnsubscribe } from "../components/email-layout";
import { Email } from "../emails/email";
import { ResourceDeletedNotification } from "../emails/fallbacks/resource-deleted-notification";
import { getCmsEmail } from "../lib/contentful";

export interface RenderResourceDeletedNotificationParams {
  host: string;
  baseUrl: string;
  resourceKind: string;
  resourceName: string;
  actor: string;
  unsubscribe?: EmailUnsubscribe;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderResourceDeletedNotification(
  params: RenderResourceDeletedNotificationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, resourceKind, resourceName, actor, unsubscribe } = params;

  const emailData = await getCmsEmail("resource-deleted-notification", {
    host,
    baseUrl,
    resourceKind,
    resourceName,
    actor,
  });

  if (!emailData) {
    const html = await render(
      ResourceDeletedNotification({
        host,
        baseUrl,
        resourceKind,
        resourceName,
        actor,
        unsubscribe,
      }),
      {},
    );
    const text = await render(
      ResourceDeletedNotification({
        host,
        baseUrl,
        resourceKind,
        resourceName,
        actor,
        unsubscribe,
      }),
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
      unsubscribe,
    }),
    {},
  );

  const text = await render(
    Email({
      host,
      baseUrl,
      cmsPreview: emailData.preview,
      cmsContent: emailData.content,
      unsubscribe,
    }),
    { plainText: true },
  );

  return { html, text, preview: emailData.preview };
}
