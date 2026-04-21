/**
 * Renders all emails and writes the HTML output to dist/email-previews/.
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

import { renderAddedUserNotification } from "../render/added-user-notification";
import { renderOtpEmail } from "../render/otp-email";
import { renderProjectTransferComplete } from "../render/project-transfer-complete";
import { renderTransferRequestConfirmation } from "../render/transfer-request-confirmation";

const outDir = join(process.cwd(), "dist/email-previews");
const host = process.env.HOST ?? "localhost";
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

function write(name: string, { html, preview }: { html: string; preview: string }): void {
  const file = join(outDir, `${name}.html`);
  const banner = `<p style="font-family:sans-serif;padding:8px 16px;"><strong>Preview:</strong> ${preview}</p>\n`;
  writeFileSync(file, banner + html);
  console.log(file);
}

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });

  write(
    "otp",
    await renderOtpEmail({
      otp: "123456",
      senderName: "openJII",
      host,
      baseUrl,
    }),
  );

  write(
    "added-user",
    await renderAddedUserNotification({
      host,
      baseUrl,
      experimentName: "My Experiment",
      experimentUrl: `${baseUrl}/en-US/platform/experiments/123`,
      actor: "Jane Doe",
      role: "member",
    }),
  );

  write(
    "transfer-complete",
    await renderProjectTransferComplete({
      host,
      baseUrl,
      experimentName: "My Experiment",
      experimentUrl: `${baseUrl}/en-US/platform/experiments/123`,
    }),
  );

  write(
    "transfer-request",
    await renderTransferRequestConfirmation({
      host,
      baseUrl,
      projectIdOld: "12345",
      projectUrlOld: "https://photosynq.org/projects/12345",
      userEmail: "researcher@example.com",
    }),
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
