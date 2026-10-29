import { parseArgs } from "node:util";

import { createSecondaryDatabase } from "@repo/database";

import { createProvisioningSecretStore } from "../oidc/provisioning/aws-secret-store";
import { instrumentTrackingClient, resolveManagedClient } from "../oidc/provisioning/manifest";
import { reconcileManagedClient } from "../oidc/provisioning/reconcile";

async function main() {
  const { values } = parseArgs({
    options: {
      client: { type: "string" },
      "operation-id": { type: "string" },
      rotate: { type: "boolean", default: false },
    },
  });
  if (
    values.client !== instrumentTrackingClient.clientId ||
    !values["operation-id"] ||
    process.env.ENVIRONMENT_PREFIX !== instrumentTrackingClient.environment
  ) {
    throw new Error("The configured client and production environment are required");
  }
  const manifest = resolveManagedClient(
    process.env.OIDC_SOURCE_ACCOUNT,
    process.env.OIDC_TARGET_ROLE_ARN,
  );
  const secrets = await createProvisioningSecretStore(manifest);
  const { database, close } = createSecondaryDatabase();
  try {
    const result = await reconcileManagedClient(database, secrets, manifest, {
      id: values["operation-id"],
      rotate: values.rotate,
    });
    console.log(JSON.stringify(result));
  } finally {
    await close();
  }
}

void main().catch(() => {
  // SDK and database errors can retain request parameters. Never log the original error.
  console.error(
    "OIDC client reconciliation failed. Retry the approved workflow; no credentials were logged.",
  );
  process.exitCode = 1;
});
