import {
  DescribeSecretCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
  UpdateSecretVersionStageCommand,
} from "@aws-sdk/client-secrets-manager";
import { AssumeRoleCommand, GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";

import type { ManagedClientManifest } from "./manifest";
import type { ClientSecretStore } from "./reconcile";

export async function createProvisioningSecretStore(
  manifest: ManagedClientManifest,
): Promise<ClientSecretStore> {
  const sts = new STSClient({ region: manifest.region });
  try {
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    const expected = `arn:aws:sts::${manifest.sourceAccount}:assumed-role/${manifest.sourceRole}/`;
    if (identity.Account !== manifest.sourceAccount || !identity.Arn?.startsWith(expected)) {
      throw new Error("Provisioning must run through the approved ECS task role");
    }
    const assumed = await sts.send(
      new AssumeRoleCommand({
        RoleArn: manifest.targetRole,
        RoleSessionName: "openjii-oidc-provision",
        DurationSeconds: 900,
      }),
    );
    const credentials = assumed.Credentials;
    if (!credentials?.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken)
      throw new Error("Provisioning role credentials unavailable");
    const client = new SecretsManagerClient({
      region: manifest.region,
      credentials: {
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken,
      },
    });
    return {
      async describe() {
        const description = await client.send(
          new DescribeSecretCommand({ SecretId: manifest.secretId }),
        );
        if (!description.ARN) throw new Error("Destination secret is missing");
        return { arn: description.ARN, versions: description.VersionIdsToStages ?? {} };
      },
      async putPending(version, value) {
        await client.send(
          new PutSecretValueCommand({
            SecretId: manifest.secretId,
            ClientRequestToken: version,
            VersionStages: ["AWSPENDING"],
            SecretString: JSON.stringify(value),
          }),
        );
      },
      async promote(version, previous) {
        if (version !== previous) {
          await client.send(
            new UpdateSecretVersionStageCommand({
              SecretId: manifest.secretId,
              VersionStage: "AWSCURRENT",
              MoveToVersionId: version,
              ...(previous ? { RemoveFromVersionId: previous } : {}),
            }),
          );
        }
        await client.send(
          new UpdateSecretVersionStageCommand({
            SecretId: manifest.secretId,
            VersionStage: "AWSPENDING",
            RemoveFromVersionId: version,
          }),
        );
      },
    };
  } finally {
    sts.destroy();
  }
}
