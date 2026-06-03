import { render } from "@react-email/components";

import { Email } from "../emails/email";
import { JoinRequestRejected } from "../emails/fallbacks/join-request-rejected";
import { getCmsEmail } from "../lib/contentful";

export interface RenderJoinRequestRejectedParams {
  host: string;
  experimentName: string;
  baseUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderJoinRequestRejected(
  params: RenderJoinRequestRejectedParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, experimentName } = params;

  const emailData = await getCmsEmail("join-request-rejected", {
    host,
    baseUrl,
    experimentName,
  });

  if (!emailData) {
    const props = { host, experimentName, baseUrl };
    const html = await render(JoinRequestRejected(props), {});
    const text = await render(JoinRequestRejected(props), { plainText: true });
    return {
      html,
      text,
      preview: `Update on your request to join ${experimentName}`,
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
