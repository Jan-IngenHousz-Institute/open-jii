import { render } from "@react-email/components";

import type { EmailUnsubscribe } from "../components/email-layout";
import { Email } from "../emails/email";
import { OrganizationJoinRequestApproved } from "../emails/fallbacks/organization-join-request-approved";
import { getCmsEmail } from "../lib/contentful";

export interface RenderOrganizationJoinRequestApprovedParams {
  host: string;
  organizationName: string;
  organizationUrl: string;
  baseUrl: string;
  unsubscribe?: EmailUnsubscribe;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderOrganizationJoinRequestApproved(
  params: RenderOrganizationJoinRequestApprovedParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, organizationName, organizationUrl, unsubscribe } = params;

  const emailData = await getCmsEmail("organization-join-request-approved", {
    host,
    baseUrl,
    organizationName,
    organizationUrl,
  });

  if (!emailData) {
    const props = { host, organizationName, organizationUrl, baseUrl, unsubscribe };
    const html = await render(OrganizationJoinRequestApproved(props), {});
    const text = await render(OrganizationJoinRequestApproved(props), { plainText: true });
    return {
      html,
      text,
      preview: `You are now a member of ${organizationName}`,
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
