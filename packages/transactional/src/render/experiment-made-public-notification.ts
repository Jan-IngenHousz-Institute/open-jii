import { render } from "@react-email/components";

import type { EmailUnsubscribe } from "../components/email-layout";
import { Email } from "../emails/email";
import { ExperimentMadePublicNotification } from "../emails/fallbacks/experiment-made-public-notification";
import { getCmsEmail } from "../lib/contentful";

export interface RenderExperimentMadePublicNotificationParams {
  host: string;
  baseUrl: string;
  experimentName: string;
  experimentUrl: string;
  unsubscribe?: EmailUnsubscribe;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderExperimentMadePublicNotification(
  params: RenderExperimentMadePublicNotificationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, experimentName, experimentUrl, unsubscribe } = params;

  const emailData = await getCmsEmail("experiment-made-public-notification", {
    host,
    baseUrl,
    experimentName,
    experimentUrl,
  });

  if (!emailData) {
    const html = await render(
      ExperimentMadePublicNotification({
        host,
        baseUrl,
        experimentName,
        experimentUrl,
        unsubscribe,
      }),
      {},
    );
    const text = await render(
      ExperimentMadePublicNotification({
        host,
        baseUrl,
        experimentName,
        experimentUrl,
        unsubscribe,
      }),
      { plainText: true },
    );
    return { html, text, preview: `${experimentName} is now public on openJII` };
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
