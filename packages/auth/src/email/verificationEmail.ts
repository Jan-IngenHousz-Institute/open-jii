import { createTransport } from "nodemailer";
import type { SentMessageInfo } from "nodemailer";

import { renderVerificationRequest } from "@repo/transactional/render/verification-request";

interface ExtendedSentMessageInfo extends SentMessageInfo {
  rejected?: string[];
  pending?: string[];
}

interface SendVerificationEmailParams {
  to: string;
  url: string;
  token: string;
  emailServer: string;
  emailFrom: string;
}

export async function sendVerificationEmail(params: SendVerificationEmailParams) {
  const { to, url, emailServer, emailFrom } = params;

  const { host } = new URL(url);
  const transport = createTransport(emailServer);

  const { html, text, qrCodeBuffer } = await renderVerificationRequest({
    url,
    host,
    senderName: "openJII",
  });

  const result = await transport.sendMail({
    to,
    from: {
      name: "openJII",
      address: emailFrom,
    },
    subject: `Sign in to the openJII Platform`,
    html,
    text,
    attachments: [
      {
        filename: "qrcode.png",
        content: qrCodeBuffer,
        cid: "qrcode",
      },
    ],
  });

  const extendedResult = result as ExtendedSentMessageInfo;
  const rejected: string[] = extendedResult.rejected ?? [];
  const pending: string[] = extendedResult.pending ?? [];
  const failed: string[] = rejected.concat(pending).filter(Boolean);

  if (failed.length > 0) {
    const failedAddresses = failed.map((failedAddress: string) =>
      typeof failedAddress === "object" && "address" in failedAddress
        ? (failedAddress as { address: string }).address
        : failedAddress,
    );
    throw new Error(`Email (${failedAddresses.join(", ")}) could not be sent`);
  }
}
