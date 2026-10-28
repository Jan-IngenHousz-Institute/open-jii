import { render } from "@react-email/components";

import { Email } from "../emails/email";
import { PasskeyAddedNotification } from "../emails/fallbacks/passkey-added-notification";
import { getCmsEmail } from "../lib/contentful";

export interface RenderPasskeyAddedNotificationParams {
  host: string;
  baseUrl: string;
  passkeyName?: string;
  securityUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderPasskeyAddedNotification(
  params: RenderPasskeyAddedNotificationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, passkeyName, securityUrl } = params;

  // A CMS entry can only fill placeholders, so the nameless sentence is its own entry.
  const emailData = passkeyName
    ? await getCmsEmail("passkey-added-notification", { host, baseUrl, passkeyName, securityUrl })
    : await getCmsEmail("passkey-added-unnamed-notification", { host, baseUrl, securityUrl });

  if (!emailData) {
    const props = { host, baseUrl, passkeyName, securityUrl };
    const html = await render(PasskeyAddedNotification(props), {});
    const text = await render(PasskeyAddedNotification(props), { plainText: true });
    return { html, text, preview: "A new passkey was added to your openJII account" };
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
