#!/usr/bin/env tsx
/**
 * Run with:  npx tsx --env-file=../../apps/backend/.env scripts/test-render.ts
 *  or via package.json script:  pnpm test:render
 *
 * Renders all emails using the live render functions (which hit Contentful)
 * and writes the HTML output to /tmp/email-*.html so you can open them in a browser.
 */
import { writeFileSync } from "fs";

import { renderAddedUserNotification } from "../src/render/added-user-notification.js";
import { renderOtpEmail } from "../src/render/otp-email.js";
import { renderProjectTransferComplete } from "../src/render/project-transfer-complete.js";
import { renderTransferRequestConfirmation } from "../src/render/transfer-request-confirmation.js";

function withPreview(html: string, preview: string): string {
  return (
    `<p style="font-family:sans-serif;padding:8px 16px;"><strong>Preview:</strong> ${preview}</p>\n` +
    html
  );
}

async function main(): Promise<void> {
  console.log("Rendering otp-email...");
  const otp = await renderOtpEmail({
    otp: "123456",
    senderName: "openJII",
    host: "localhost",
    baseUrl: "http://localhost:3000",
  });
  writeFileSync("/tmp/email-otp.html", withPreview(otp.html, otp.preview));
  console.log("  → /tmp/email-otp.html");

  console.log("Rendering added-user-notification...");
  const addedUser = await renderAddedUserNotification({
    host: "localhost",
    baseUrl: "http://localhost:3000",
    experimentName: "My Experiment",
    experimentUrl: "http://localhost:3000/en-US/platform/experiments/123",
    actor: "Jane Doe",
    role: "member",
  });
  writeFileSync("/tmp/email-added-user.html", withPreview(addedUser.html, addedUser.preview));
  console.log("  → /tmp/email-added-user.html");

  console.log("Rendering project-transfer-complete...");
  const transferComplete = await renderProjectTransferComplete({
    host: "localhost",
    baseUrl: "http://localhost:3000",
    experimentName: "My Experiment",
    experimentUrl: "http://localhost:3000/en-US/platform/experiments/123",
  });
  writeFileSync(
    "/tmp/email-transfer-complete.html",
    withPreview(transferComplete.html, transferComplete.preview),
  );
  console.log("  → /tmp/email-transfer-complete.html");

  console.log("Rendering transfer-request-confirmation...");
  const transferRequest = await renderTransferRequestConfirmation({
    host: "localhost",
    baseUrl: "http://localhost:3000",
    projectIdOld: "12345",
    projectUrlOld: "https://photosynq.org/projects/12345",
    userEmail: "researcher@example.com",
  });
  writeFileSync(
    "/tmp/email-transfer-request.html",
    withPreview(transferRequest.html, transferRequest.preview),
  );
  console.log("  → /tmp/email-transfer-request.html");

  console.log("\nDone. Open with:");
  console.log("  open /tmp/email-otp.html");
  console.log("  open /tmp/email-added-user.html");
  console.log("  open /tmp/email-transfer-complete.html");
  console.log("  open /tmp/email-transfer-request.html");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
