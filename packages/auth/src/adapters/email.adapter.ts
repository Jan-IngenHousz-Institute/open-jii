import { render } from "@react-email/components";
import { createTransport } from "nodemailer";
import { toDataURL } from "qrcode";
// @ts-expect-error - React types missing
import React from "react";

import { VerificationRequest } from "@repo/transactional/emails/verification-request";

import type { AuthEmailPort } from "../ports/email.port";

export class NodeMailerAuthEmailAdapter implements AuthEmailPort {
  async sendVerificationEmail(email: string, url: string): Promise<void> {
    const qrCodeDataUrl = await toDataURL(url);
    const emailHtml = await render(
      React.createElement(VerificationRequest, {
        url,
        host: process.env.EMAIL_BASE_URL ?? "openjii.org",
        senderName: "openJII",
        qrCodeDataUrl,
      }),
    );

    const transporter = createTransport(process.env.EMAIL_SERVER);

    await transporter.sendMail({
      to: email,
      from: process.env.EMAIL_FROM,
      subject: "Sign in to openJII",
      html: emailHtml,
    });
  }
}
