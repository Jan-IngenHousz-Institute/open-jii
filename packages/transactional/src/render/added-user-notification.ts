import { render as reactEmailRender } from "@react-email/components";
import { render as emailmdRender } from "emailmd";

import { Email } from "../emails/email.js";
import { getCmsEmail, interpolate } from "../lib/contentful";

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
}

export async function renderAddedUserNotification(
  params: RenderAddedUserNotificationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, experimentName, experimentUrl, actor, role } = params;

  const emailData = await getCmsEmail("added-user-notification");

  if (!emailData) throw new Error("[transactional] CMS email 'added-user-notification' not found");

  const markdown = interpolate(emailData.content, {
    host,
    baseUrl,
    experimentName,
    experimentUrl,
    actor,
    role,
  });
  const { html: fullHtml, text } = emailmdRender(markdown);
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(fullHtml);
  const cmsContent = bodyMatch?.[1] ?? fullHtml;

  const html = await reactEmailRender(
    Email({
      host,
      baseUrl,
      cmsContent,
      cmsPreview: emailData.preview,
    }),
    {},
  );

  return { html, text };
}
