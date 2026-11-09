import { render } from "@react-email/components";

import type { EmailUnsubscribe } from "../components/email-layout";
import { Email } from "../emails/email";
import { DataUploadCompletedNotification } from "../emails/fallbacks/data-upload-completed-notification";
import { getCmsEmail } from "../lib/contentful";

export interface RenderDataUploadCompletedNotificationParams {
  host: string;
  baseUrl: string;
  experimentName: string;
  dataUrl: string;
  unsubscribe?: EmailUnsubscribe;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderDataUploadCompletedNotification(
  params: RenderDataUploadCompletedNotificationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, experimentName, dataUrl, unsubscribe } = params;

  const emailData = await getCmsEmail("data-upload-completed-notification", {
    host,
    baseUrl,
    experimentName,
    dataUrl,
  });

  if (!emailData) {
    const html = await render(
      DataUploadCompletedNotification({ host, baseUrl, experimentName, dataUrl, unsubscribe }),
      {},
    );
    const text = await render(
      DataUploadCompletedNotification({ host, baseUrl, experimentName, dataUrl, unsubscribe }),
      { plainText: true },
    );
    return {
      html,
      text,
      preview: `Your upload to ${experimentName} is ready to query`,
    };
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
