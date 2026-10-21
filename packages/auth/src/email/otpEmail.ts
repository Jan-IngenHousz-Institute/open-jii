import { createTransport } from "nodemailer";

import { renderOtpEmail } from "@repo/transactional/render/otp-email";

import { isGuestRecipient } from "../guest/recipient";

interface SendOtpEmailParams {
  to: string;
  otp: string;
  emailServer: string;
  emailFrom: string;
  senderName: string;
  baseUrl: string;
}

export async function sendOtpEmail(params: SendOtpEmailParams) {
  if (await isGuestRecipient(params.to)) return;
  const { to, otp, emailServer, emailFrom, senderName, baseUrl } = params;

  const url = new URL(baseUrl);
  const host = url.host;

  const transport = createTransport(emailServer);

  const { html, text } = await renderOtpEmail({ otp, senderName, host, baseUrl });

  await transport.sendMail({
    to,
    from: {
      name: senderName,
      address: emailFrom,
    },
    subject: `Your login code for ${senderName}`,
    html,
    text,
  });
}
