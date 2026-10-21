import { render } from "@react-email/components";

import { Email } from "../emails/email";
import { OrganizationMembershipRemoved } from "../emails/fallbacks/organization-membership-removed";
import { getCmsEmail } from "../lib/contentful";

export interface RenderOrganizationMembershipRemovedParams {
  host: string;
  baseUrl: string;
  organizationName: string;
  actor: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderOrganizationMembershipRemoved(
  params: RenderOrganizationMembershipRemovedParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, organizationName, actor } = params;

  const emailData = await getCmsEmail("organization-membership-removed", {
    host,
    baseUrl,
    organizationName,
    actor,
  });

  if (!emailData) {
    const props = { host, baseUrl, organizationName, actor };
    const html = await render(OrganizationMembershipRemoved(props), {});
    const text = await render(OrganizationMembershipRemoved(props), { plainText: true });
    return { html, text, preview: `You were removed from ${organizationName}` };
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
