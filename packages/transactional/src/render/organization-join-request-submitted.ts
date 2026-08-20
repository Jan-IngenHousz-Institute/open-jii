import { render } from "@react-email/components";

import { Email } from "../emails/email";
import { OrganizationJoinRequestSubmitted } from "../emails/fallbacks/organization-join-request-submitted";
import { getCmsEmail } from "../lib/contentful";

export interface RenderOrganizationJoinRequestSubmittedParams {
  host: string;
  organizationName: string;
  organizationUrl: string;
  requesterName: string;
  message?: string;
  baseUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderOrganizationJoinRequestSubmitted(
  params: RenderOrganizationJoinRequestSubmittedParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, organizationName, organizationUrl, requesterName, message } = params;

  const emailData = await getCmsEmail("organization-join-request-submitted", {
    host,
    baseUrl,
    organizationName,
    organizationUrl,
    requesterName,
    message: message ?? "",
  });

  if (!emailData) {
    const props = { host, organizationName, organizationUrl, requesterName, message, baseUrl };
    const html = await render(OrganizationJoinRequestSubmitted(props), {});
    const text = await render(OrganizationJoinRequestSubmitted(props), { plainText: true });
    return {
      html,
      text,
      preview: `${requesterName} requested to join ${organizationName}`,
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
