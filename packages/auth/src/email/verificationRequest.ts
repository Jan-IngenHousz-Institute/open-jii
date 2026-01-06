import type { NodemailerConfig } from "@auth/core/providers/nodemailer";
import { render } from "@react-email/components";
import { createTransport } from "nodemailer";
import type { SentMessageInfo } from "nodemailer";
import QRCode from "qrcode";

import { VerificationRequest } from "@repo/transactional/emails/verification-request";

interface ExtendedSentMessageInfo extends SentMessageInfo {
  rejected?: string[];
  pending?: string[];
}

export async function sendVerificationRequest(params: {
  identifier: string;
  url: string;
  expires: Date;
  provider: NodemailerConfig;
  token: string;
  request: Request;
}) {
  const { identifier, url, provider } = params;

  if (provider.from === undefined) {
    throw new Error("Email provider 'from' address is not configured");
  }

  const { host } = new URL(url);
  const transport = createTransport(provider.server);
  const qrCodeDataUrl = await QRCode.toDataURL(url, {
    width: 200,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  const emailHtml = await render(
    VerificationRequest({ url, host, senderName: "openJII", qrCodeDataUrl }),
    {},
  );
  const emailText = await render(
    VerificationRequest({ url, host, senderName: "openJII", qrCodeDataUrl }),
    {
      plainText: true,
    },
  );

  const result = await transport.sendMail({
    to: identifier,
    from: {
      name: "openJII",
      address: provider.from,
    },
    subject: `Sign in to the openJII Platform`,
    html: emailHtml,
    text: emailText,
  });

  // Cast result to extended type to handle optional rejected/pending properties
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
