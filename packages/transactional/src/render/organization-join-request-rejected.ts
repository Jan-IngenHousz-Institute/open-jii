import { render } from "@react-email/components";

import { Email } from "../emails/email";
import { OrganizationJoinRequestRejected } from "../emails/fallbacks/organization-join-request-rejected";
import { getCmsEmail } from "../lib/contentful";

export interface RenderOrganizationJoinRequestRejectedParams {
  host: string;
  organizationName: string;
  baseUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderOrganizationJoinRequestRejected(
  params: RenderOrganizationJoinRequestRejectedParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, organizationName } = params;

  const emailData = await getCmsEmail("organization-join-request-rejected", {
    host,
    baseUrl,
    organizationName,
  });

  if (!emailData) {
    const props = { host, organizationName, baseUrl };
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
