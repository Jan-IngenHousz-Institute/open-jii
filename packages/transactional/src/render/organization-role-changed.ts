import { render } from "@react-email/components";

import type { EmailUnsubscribe } from "../components/email-layout";
import { Email } from "../emails/email";
import { OrganizationRoleChanged } from "../emails/fallbacks/organization-role-changed";
import { getCmsEmail } from "../lib/contentful";

export interface RenderOrganizationRoleChangedParams {
  host: string;
  baseUrl: string;
  organizationName: string;
  organizationUrl: string;
  actor: string;
  role: string;
  unsubscribe?: EmailUnsubscribe;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderOrganizationRoleChanged(
  params: RenderOrganizationRoleChangedParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, organizationName, organizationUrl, actor, role, unsubscribe } = params;

  const emailData = await getCmsEmail("organization-role-changed", {
    host,
    baseUrl,
    organizationName,
    organizationUrl,
    actor,
    role,
  });

  if (!emailData) {
    const props = { host, baseUrl, organizationName, organizationUrl, actor, role, unsubscribe };
    const html = await render(OrganizationRoleChanged(props), {});
    const text = await render(OrganizationRoleChanged(props), { plainText: true });
    return { html, text, preview: `Your role in ${organizationName} changed` };
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
