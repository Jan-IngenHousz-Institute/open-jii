import { render } from "@react-email/components";

import type { EmailUnsubscribe } from "../components/email-layout";
import { Email } from "../emails/email";
import { OrganizationInvitation } from "../emails/fallbacks/organization-invitation";
import { getCmsEmail } from "../lib/contentful";

export interface RenderOrganizationInvitationParams {
  host: string;
  organizationName: string;
  inviteUrl: string;
  inviterName: string;
  role: string;
  baseUrl: string;
  unsubscribe?: EmailUnsubscribe;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderOrganizationInvitation(
  params: RenderOrganizationInvitationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, organizationName, inviteUrl, inviterName, role, unsubscribe } = params;

  const emailData = await getCmsEmail("organization-invitation", {
    host,
    baseUrl,
    organizationName,
    inviteUrl,
    inviterName,
    role,
  });

  if (!emailData) {
    const props = { host, organizationName, inviteUrl, inviterName, role, baseUrl, unsubscribe };
    const html = await render(OrganizationInvitation(props), {});
    const text = await render(OrganizationInvitation(props), { plainText: true });
    return {
      html,
      text,
      preview: `${inviterName} invited you to join ${organizationName}`,
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
