import { render } from "@react-email/components";

import type { EmailUnsubscribe } from "../components/email-layout";
import { Email } from "../emails/email";
import { JoinRequestRejected } from "../emails/fallbacks/join-request-rejected";
import { getCmsEmail } from "../lib/contentful";

export interface RenderJoinRequestRejectedParams {
  host: string;
  experimentName: string;
  baseUrl: string;
  unsubscribe?: EmailUnsubscribe;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderJoinRequestRejected(
  params: RenderJoinRequestRejectedParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, experimentName, unsubscribe } = params;

  const emailData = await getCmsEmail("join-request-rejected", {
    host,
    baseUrl,
    experimentName,
  });

  if (!emailData) {
    const props = { host, experimentName, baseUrl, unsubscribe };
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
