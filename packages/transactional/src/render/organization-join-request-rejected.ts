import { render } from "@react-email/components";

import type { EmailUnsubscribe } from "../components/email-layout";
import { Email } from "../emails/email";
import { OrganizationJoinRequestRejected } from "../emails/fallbacks/organization-join-request-rejected";
import { getCmsEmail } from "../lib/contentful";

export interface RenderOrganizationJoinRequestRejectedParams {
  host: string;
  organizationName: string;
  baseUrl: string;
  unsubscribe?: EmailUnsubscribe;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderOrganizationJoinRequestRejected(
  params: RenderOrganizationJoinRequestRejectedParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, organizationName, unsubscribe } = params;

  const emailData = await getCmsEmail("organization-join-request-rejected", {
    host,
    baseUrl,
    organizationName,
  });

  if (!emailData) {
    const props = { host, organizationName, baseUrl, unsubscribe };
    const html = await render(OrganizationJoinRequestRejected(props), {});
    const text = await render(OrganizationJoinRequestRejected(props), { plainText: true });
    return {
      html,
      text,
      preview: `Update on your request to join ${organizationName}`,
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
