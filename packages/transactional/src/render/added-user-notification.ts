import { render } from "@react-email/components";

import { Email } from "../emails/email";
import { getCmsEmail } from "../lib/contentful";

export interface RenderAddedUserNotificationParams {
  host: string;
  experimentName: string;
  experimentUrl: string;
  actor: string;
  role: string;
  baseUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderAddedUserNotification(
  params: RenderAddedUserNotificationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, experimentName, experimentUrl, actor, role } = params;

  const emailData = await getCmsEmail("added-user-notification", {
    host,
    baseUrl,
    experimentName,
    experimentUrl,
    actor,
    role,
  });

  if (!emailData) throw new Error("[transactional] CMS email 'added-user-notification' not found");

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
