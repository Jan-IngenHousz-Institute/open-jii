/**
 * Renders all emails and writes the HTML output to dist/email-previews/.
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

import { renderAccessGrantedNotification } from "../render/access-granted-notification";
import { renderApiKeyCreatedNotification } from "../render/api-key-created-notification";
import { renderExperimentMadePublicNotification } from "../render/experiment-made-public-notification";
import { renderOrganizationMembershipRemoved } from "../render/organization-membership-removed";
import { renderOrganizationRoleChanged } from "../render/organization-role-changed";
import { renderOtpEmail } from "../render/otp-email";
import { renderPasskeyAddedNotification } from "../render/passkey-added-notification";
import { renderProjectTransferComplete } from "../render/project-transfer-complete";
import { renderResourceDeletedNotification } from "../render/resource-deleted-notification";
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
    "access-granted",
    await renderAccessGrantedNotification({
      host,
      baseUrl,
      resourceKind: "workbook",
      resourceName: "Leaf Area Index",
      resourceUrl: `${baseUrl}/en-US/platform/workbooks/123`,
      actor: "Jane Doe",
      role: "a collaborator who can view",
    }),
  );

  write(
    "resource-deleted",
    await renderResourceDeletedNotification({
      host,
      baseUrl,
      resourceKind: "device group",
      resourceName: "North Field Sensors",
      actor: "Jane Doe",
    }),
  );

  write(
    "organization-role-changed",
    await renderOrganizationRoleChanged({
      host,
      baseUrl,
      organizationName: "Photosynthesis Lab",
      organizationUrl: `${baseUrl}/en-US/platform/organizations/123`,
      actor: "Jane Doe",
      role: "an admin of",
    }),
  );

  write(
    "organization-membership-removed",
    await renderOrganizationMembershipRemoved({
      host,
      baseUrl,
      organizationName: "Photosynthesis Lab",
      actor: "Jane Doe",
    }),
  );

  write(
    "experiment-made-public",
    await renderExperimentMadePublicNotification({
      host,
      baseUrl,
      experimentName: "Leaf Area Index",
      experimentUrl: `${baseUrl}/en-US/platform/experiments/123`,
    }),
  );

  write(
    "api-key-created",
    await renderApiKeyCreatedNotification({
      host,
      baseUrl,
      keyName: "Field laptop",
      apiKeysUrl: `${baseUrl}/en-US/platform/account/api-keys`,
    }),
  );

  write(
    "passkey-added",
    await renderPasskeyAddedNotification({
      host,
      baseUrl,
      passkeyName: "Google Password Manager",
      securityUrl: `${baseUrl}/en-US/platform/account/security`,
    }),
  );

  write(
    "passkey-added-unnamed",
    await renderPasskeyAddedNotification({
      host,
      baseUrl,
      securityUrl: `${baseUrl}/en-US/platform/account/security`,
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
