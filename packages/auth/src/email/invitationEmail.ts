import { createTransport } from "nodemailer";

interface SendInvitationEmailParams {
  to: string;
  inviteLink: string;
  organizationName: string;
  inviterName?: string | null;
  emailServer: string;
  emailFrom: string;
  senderName: string;
}

/** Send an organization invitation email with an accept link. */
export async function sendInvitationEmail(params: SendInvitationEmailParams) {
  const { to, inviteLink, organizationName, inviterName, emailServer, emailFrom, senderName } =
    params;

  const transport = createTransport(emailServer);
  const invitedBy = inviterName ?? "A teammate";
  const text =
    `${invitedBy} invited you to join ${organizationName} on ${senderName}.\n\n` +
    `Accept the invitation: ${inviteLink}`;
  const html =
    `<p>${invitedBy} invited you to join <strong>${organizationName}</strong> on ${senderName}.</p>` +
    `<p><a href="${inviteLink}">Accept invitation</a></p>`;

  await transport.sendMail({
    to,
    from: { name: senderName, address: emailFrom },
    subject: `You've been invited to ${organizationName}`,
    html,
    text,
  });
}
