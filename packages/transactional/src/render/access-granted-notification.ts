import { render } from "@react-email/components";

import type { EmailUnsubscribe } from "../components/email-layout";
import { Email } from "../emails/email";
import { AccessGrantedNotification } from "../emails/fallbacks/access-granted-notification";
import { getCmsEmail } from "../lib/contentful";

export interface RenderAccessGrantedNotificationParams {
  host: string;
  baseUrl: string;
  resourceKind: string;
  resourceName: string;
  resourceUrl: string;
  actor: string;
  role: string;
  unsubscribe?: EmailUnsubscribe;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderAccessGrantedNotification(
  params: RenderAccessGrantedNotificationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, resourceKind, resourceName, resourceUrl, actor, role, unsubscribe } =
    params;

  const emailData = await getCmsEmail("access-granted-notification", {
    host,
    baseUrl,
    resourceKind,
    resourceName,
    resourceUrl,
    actor,
    role,
  });

  if (!emailData) {
    const html = await render(
      AccessGrantedNotification({
        host,
        baseUrl,
        resourceKind,
        resourceName,
        resourceUrl,
        actor,
        role,
        unsubscribe,
      }),
      {},
    );
    const text = await render(
      AccessGrantedNotification({
        host,
        baseUrl,
        resourceKind,
        resourceName,
        resourceUrl,
        actor,
        role,
        unsubscribe,
      }),
      { plainText: true },
    );
    return { html, text, preview: `You now have access to ${resourceName} on openJII` };
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
