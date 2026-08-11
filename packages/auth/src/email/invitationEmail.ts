import { createTransport } from "nodemailer";

import { renderOrganizationInvitation } from "@repo/transactional/render/organization-invitation";

interface SendOrganizationInvitationEmailParams {
  to: string;
  inviteUrl: string;
  organizationName: string;
  inviterName: string;
  role: string;
  emailServer: string;
  emailFrom: string;
  senderName: string;
  baseUrl: string;
}

export async function sendOrganizationInvitationEmail(
  params: SendOrganizationInvitationEmailParams,
) {
  const {
    to,
    inviteUrl,
    organizationName,
    inviterName,
    role,
    emailServer,
    emailFrom,
    senderName,
    baseUrl,
  } = params;

  const host = new URL(baseUrl).host;
  const transport = createTransport(emailServer);

  const { html, text } = await renderOrganizationInvitation({
    host,
    baseUrl,
    organizationName,
    inviteUrl,
    inviterName,
    role,
  });

  await transport.sendMail({
    to,
    from: { name: senderName, address: emailFrom },
    subject: `You've been invited to join ${organizationName}`,
    html,
    text,
  });
}
