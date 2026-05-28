import { render } from "@react-email/components";

import { Email } from "../emails/email";
import { JoinRequestSubmitted } from "../emails/fallbacks/join-request-submitted";
import { getCmsEmail } from "../lib/contentful";

export interface RenderJoinRequestSubmittedParams {
  host: string;
  experimentName: string;
  experimentUrl: string;
  requesterName: string;
  message?: string;
  baseUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderJoinRequestSubmitted(
  params: RenderJoinRequestSubmittedParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, experimentName, experimentUrl, requesterName, message } = params;

  const emailData = await getCmsEmail("join-request-submitted", {
    host,
    baseUrl,
    experimentName,
    experimentUrl,
    requesterName,
    message: message ?? "",
  });

  if (!emailData) {
    const props = { host, experimentName, experimentUrl, requesterName, message, baseUrl };
    const html = await render(JoinRequestSubmitted(props), {});
    const text = await render(JoinRequestSubmitted(props), { plainText: true });
    return {
      html,
      text,
      preview: `${requesterName} requested to join ${experimentName}`,
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
