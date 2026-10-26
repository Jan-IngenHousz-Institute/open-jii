import { render } from "@react-email/components";

import { Email } from "../emails/email";
import { ExperimentMadePublicNotification } from "../emails/fallbacks/experiment-made-public-notification";
import { getCmsEmail } from "../lib/contentful";

export interface RenderExperimentMadePublicNotificationParams {
  host: string;
  baseUrl: string;
  experimentName: string;
  experimentUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderExperimentMadePublicNotification(
  params: RenderExperimentMadePublicNotificationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, experimentName, experimentUrl } = params;

  const emailData = await getCmsEmail("experiment-made-public-notification", {
    host,
    baseUrl,
    experimentName,
    experimentUrl,
  });

  if (!emailData) {
    const html = await render(
      ExperimentMadePublicNotification({ host, baseUrl, experimentName, experimentUrl }),
      {},
    );
    const text = await render(
      ExperimentMadePublicNotification({ host, baseUrl, experimentName, experimentUrl }),
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
