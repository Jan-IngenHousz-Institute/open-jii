import { render } from "@react-email/components";

import type { EmailUnsubscribe } from "../components/email-layout";
import { Email } from "../emails/email";
import { DataExportFailedNotification } from "../emails/fallbacks/data-export-failed-notification";
import { getCmsEmail } from "../lib/contentful";

export interface RenderDataExportFailedNotificationParams {
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

export async function renderDataExportFailedNotification(
  params: RenderDataExportFailedNotificationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, experimentName, dataUrl, unsubscribe } = params;

  const emailData = await getCmsEmail("data-export-failed-notification", {
    host,
    baseUrl,
    experimentName,
    dataUrl,
  });

  if (!emailData) {
    const html = await render(
      DataExportFailedNotification({
        host,
        baseUrl,
        experimentName,
        dataUrl,
        unsubscribe,
      }),
      {},
    );
    const text = await render(
      DataExportFailedNotification({
        host,
        baseUrl,
        experimentName,
        dataUrl,
        unsubscribe,
      }),
      { plainText: true },
    );
    return {
      html,
      text,
      preview: `Your export of ${experimentName} failed`,
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
