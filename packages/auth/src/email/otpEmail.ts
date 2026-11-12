import { createTransport } from "nodemailer";

import { renderOtpEmail } from "@repo/transactional/render/otp-email";

interface SendOtpEmailParams {
  to: string;
  otp: string;
  emailServer: string;
  emailFrom: string;
  senderName: string;
  baseUrl: string;
  /** The same code confirms a new address during registration; the subject says which. */
  purpose?: "sign-in" | "confirm-email";
}

export async function sendOtpEmail(params: SendOtpEmailParams) {
  const { to, otp, emailServer, emailFrom, senderName, baseUrl, purpose = "sign-in" } = params;

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
    subject:
      purpose === "confirm-email"
        ? `Your code to confirm your email address for ${senderName}`
        : `Your login code for ${senderName}`,
    html,
    text,
  });
}
