import type { NodemailerConfig } from "@auth/core/providers/nodemailer";
import { render } from "@react-email/components";
import { createTransport } from "nodemailer";
import VerificationRequest from "transactional/emails/verification-request";

export async function sendVerificationRequest(params: {
  identifier: string;
  url: string;
  expires: Date;
  provider: NodemailerConfig;
  token: string;
  request: Request;
}) {
  const { identifier, url, provider } = params;
  const { host } = new URL(url);
  const transport = createTransport(provider.server);

  const emailHtml = await render(VerificationRequest({ url }));
  const emailText = await render(VerificationRequest({ url }), { plainText: true });

  const result = await transport.sendMail({
    to: identifier,
    from: provider.from,
    subject: `Sign in to ${host}`,
    html: emailHtml,
    text: emailText,
  });
  const rejected = result.rejected;
  const pending = result.pending;
  const failed = rejected.concat(pending).filter(Boolean);
  if (failed.length) {
    const failedAddresses = failed.map((failedAddress) =>
      typeof failedAddress === "object" && "address" in failedAddress
        ? failedAddress.address
        : failedAddress,
    );
    throw new Error(`Email (${failedAddresses.join(", ")}) could not be sent`);
  }
}
