import { render } from "@react-email/components";

import { Email } from "../emails/email";
import { AddedUserNotification } from "../emails/fallbacks/added-user-notification";
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

  if (!emailData) {
    const html = await render(
      AddedUserNotification({ host, experimentName, experimentUrl, actor, role, baseUrl }),
      {},
    );
    const text = await render(
      AddedUserNotification({ host, experimentName, experimentUrl, actor, role, baseUrl }),
      { plainText: true },
    );
    return { html, text, preview: "You've been added to an experiment on openJII" };
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
