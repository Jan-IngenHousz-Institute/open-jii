import { render } from "@react-email/components";

import type { EmailUnsubscribe } from "../components/email-layout";
import { Email } from "../emails/email";
import { DataExportReadyNotification } from "../emails/fallbacks/data-export-ready-notification";
import { getCmsEmail } from "../lib/contentful";

export interface RenderDataExportReadyNotificationParams {
  host: string;
  baseUrl: string;
  experimentName: string;
  format: string;
  dataUrl: string;
  unsubscribe?: EmailUnsubscribe;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderDataExportReadyNotification(
  params: RenderDataExportReadyNotificationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, experimentName, format, dataUrl, unsubscribe } = params;

  const emailData = await getCmsEmail("data-export-ready-notification", {
    host,
    baseUrl,
    experimentName,
    format,
    dataUrl,
  });

  if (!emailData) {
    const html = await render(
      DataExportReadyNotification({
        host,
        baseUrl,
        experimentName,
        format,
        dataUrl,
        unsubscribe,
      }),
      {},
    );
    const text = await render(
      DataExportReadyNotification({
        host,
        baseUrl,
        experimentName,
        format,
        dataUrl,
        unsubscribe,
      }),
      { plainText: true },
    );
    return {
      html,
      text,
      preview: `Your ${format} export of ${experimentName} is ready`,
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
