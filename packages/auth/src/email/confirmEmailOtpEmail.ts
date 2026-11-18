import { createTransport } from "nodemailer";

import { renderConfirmEmailOtp } from "@repo/transactional/render/confirm-email-otp";

interface SendConfirmEmailOtpEmailParams {
  to: string;
  otp: string;
  emailServer: string;
  emailFrom: string;
  senderName: string;
  baseUrl: string;
}

export async function sendConfirmEmailOtpEmail(params: SendConfirmEmailOtpEmailParams) {
  const { to, otp, emailServer, emailFrom, senderName, baseUrl } = params;

  const url = new URL(baseUrl);
  const host = url.host;

  const transport = createTransport(emailServer);

  const { html, text } = await renderConfirmEmailOtp({ otp, senderName, host, baseUrl });

  await transport.sendMail({
    to,
    from: {
      name: senderName,
      address: emailFrom,
    },
    subject: `Your code to confirm your email address for ${senderName}`,
    html,
    text,
  });
}
