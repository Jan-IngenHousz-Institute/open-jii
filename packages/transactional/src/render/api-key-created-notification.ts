import { render } from "@react-email/components";

import { Email } from "../emails/email";
import { ApiKeyCreatedNotification } from "../emails/fallbacks/api-key-created-notification";
import { getCmsEmail } from "../lib/contentful";

export interface RenderApiKeyCreatedNotificationParams {
  host: string;
  baseUrl: string;
  keyName: string;
  apiKeysUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderApiKeyCreatedNotification(
  params: RenderApiKeyCreatedNotificationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, keyName, apiKeysUrl } = params;

  const emailData = await getCmsEmail("api-key-created-notification", {
    host,
    baseUrl,
    keyName,
    apiKeysUrl,
  });

  if (!emailData) {
    const props = { host, baseUrl, keyName, apiKeysUrl };
    const html = await render(ApiKeyCreatedNotification(props), {});
    const text = await render(ApiKeyCreatedNotification(props), { plainText: true });
    return { html, text, preview: `A new API key, ${keyName}, was added to your openJII account` };
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
