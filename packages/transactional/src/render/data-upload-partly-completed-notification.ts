import { render } from "@react-email/components";

import type { EmailUnsubscribe } from "../components/email-layout";
import { linesPanelHtmlToTextOptions } from "../components/lines-panel";
import { Email } from "../emails/email";
import { DataUploadPartlyCompletedNotification } from "../emails/fallbacks/data-upload-partly-completed-notification";
import { getCmsEmail } from "../lib/contentful";

export interface RenderDataUploadPartlyCompletedNotificationParams {
  host: string;
  baseUrl: string;
  experimentName: string;
  skippedCount: string;
  skippedFiles: string;
  dataUrl: string;
  unsubscribe?: EmailUnsubscribe;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderDataUploadPartlyCompletedNotification(
  params: RenderDataUploadPartlyCompletedNotificationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, experimentName, skippedCount, skippedFiles, dataUrl, unsubscribe } =
    params;

  const emailData = await getCmsEmail("data-upload-partly-completed-notification", {
    host,
    baseUrl,
    experimentName,
    skippedCount,
    skippedFiles: skippedFiles.split("\n"),
    dataUrl,
  });

  if (!emailData) {
    const props = {
      host,
      baseUrl,
      experimentName,
      skippedCount,
      skippedFiles,
      dataUrl,
      unsubscribe,
    };
    const html = await render(DataUploadPartlyCompletedNotification(props), {});
    const text = await render(DataUploadPartlyCompletedNotification(props), {
      plainText: true,
      htmlToTextOptions: linesPanelHtmlToTextOptions,
    });
    return {
      html,
      text,
      preview: `Your upload to ${experimentName} is ready to query, with files left out`,
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
    { plainText: true, htmlToTextOptions: linesPanelHtmlToTextOptions },
  );

  return { html, text, preview: emailData.preview };
}
