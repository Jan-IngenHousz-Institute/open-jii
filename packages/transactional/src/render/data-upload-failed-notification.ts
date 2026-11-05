import { render } from "@react-email/components";

import { Email } from "../emails/email";
import { DataUploadFailedNotification } from "../emails/fallbacks/data-upload-failed-notification";
import { getCmsEmail } from "../lib/contentful";

export interface RenderDataUploadFailedNotificationParams {
  host: string;
  baseUrl: string;
  experimentName: string;
  tableName: string;
  dataUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderDataUploadFailedNotification(
  params: RenderDataUploadFailedNotificationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, experimentName, tableName, dataUrl } = params;

  const emailData = await getCmsEmail("data-upload-failed-notification", {
    host,
    baseUrl,
    experimentName,
    tableName,
    dataUrl,
  });

  if (!emailData) {
    const html = await render(
      DataUploadFailedNotification({ host, baseUrl, experimentName, tableName, dataUrl }),
      {},
    );
    const text = await render(
      DataUploadFailedNotification({ host, baseUrl, experimentName, tableName, dataUrl }),
      { plainText: true },
    );
    return {
      html,
      text,
      preview: `Your upload to ${tableName} in ${experimentName} failed`,
    };
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
