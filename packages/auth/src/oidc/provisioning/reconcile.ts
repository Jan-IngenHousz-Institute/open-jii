import { createHash, randomBytes, randomUUID } from "node:crypto";

import { eq, or, sql } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";
import { oauthClients } from "@repo/database/schema";

import { managedBy } from "./manifest";
import type { ManagedClientManifest } from "./manifest";

export interface SecretState {
  arn: string;
  versions: Partial<Record<string, string[]>>;
}

export interface ClientSecretStore {
  describe(): Promise<SecretState>;
  putPending(
    version: string,
    credentials: { client_id: string; client_secret: string },
  ): Promise<void>;
  promote(version: string, previous?: string): Promise<void>;
}

interface ManagedMetadata {
  managedBy: string;
  repository: string;
  environment: string;
  secretArn: string;
  secretVersionId: string;
  operationId: string;
}

function metadataOf(value: unknown): ManagedMetadata {
  if (typeof value !== "object" || value === null) throw new Error("Unmanaged OAuth client");
  const record = value as Record<string, unknown>;
  const keys = [
    "managedBy",
    "repository",
    "environment",
    "secretArn",
    "secretVersionId",
    "operationId",
  ] as const;
  for (const key of keys) {
    if (!(key in value) || typeof record[key] !== "string")
      throw new Error("Incomplete client ownership metadata");
  }
  return value as ManagedMetadata;
}

function assertOwnedClient(
  client: typeof oauthClients.$inferSelect,
  manifest: ManagedClientManifest,
  secret: SecretState,
) {
  const metadata = metadataOf(client.metadata);
  const expected = {
    clientId: manifest.clientId,
    referenceId: manifest.referenceId,
    userId: null,
    name: manifest.name,
    redirectUris: [...manifest.redirectUris],
    scopes: [...manifest.scopes],
    grantTypes: [...manifest.grantTypes],
    responseTypes: [...manifest.responseTypes],
    disabled: false,
    skipConsent: true,
    requirePKCE: true,
    public: false,
    type: "web",
    tokenEndpointAuthMethod: "client_secret_basic",
  };
  for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
    if (JSON.stringify(client[key]) !== JSON.stringify(expected[key]))
      throw new Error("Conflicting OAuth client configuration");
  }
  if (
    metadata.managedBy !== managedBy ||
    metadata.repository !== manifest.repository ||
    metadata.environment !== manifest.environment ||
    metadata.secretArn !== secret.arn ||
    !client.clientSecret
  ) {
    throw new Error("Conflicting OAuth client ownership");
  }
  return metadata;
}

export function hashOAuthClientSecret(secret: string): string {
  // @better-auth/oauth-provider 1.6.23 uses SHA-256 with unpadded base64url encoding.
  return createHash("sha256").update(secret).digest("base64url");
}

export async function reconcileManagedClient(
  database: DatabaseInstance,
  secrets: ClientSecretStore,
  manifest: ManagedClientManifest,
  operation: { id: string; rotate: boolean },
): Promise<{
  action: "created" | "rotated" | "resumed" | "unchanged";
  clientId: string;
  versionId: string;
}> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(operation.id))
    throw new Error("Invalid deployment operation ID");
  // The caller dedicates a max:1 database connection so this session lock spans commits and promotion.
  await database.execute(
    sql`select pg_advisory_lock(hashtextextended(${manifest.referenceId}, 0))`,
  );
  try {
    const records = await database
      .select()
      .from(oauthClients)
      .where(
        or(
          eq(oauthClients.clientId, manifest.clientId),
          eq(oauthClients.referenceId, manifest.referenceId),
          eq(oauthClients.name, manifest.name),
        ),
      );
    if (records.length > 1) throw new Error("Ambiguous OAuth client ownership");
    const state = await secrets.describe();
    if (!state.arn.startsWith(manifest.secretArnPrefix))
      throw new Error("Unexpected destination secret");
    const currentVersions = Object.entries(state.versions).filter(([, stages]) =>
      stages?.includes("AWSCURRENT"),
    );
    if (currentVersions.length > 1) throw new Error("Ambiguous current secret version");
    const current = currentVersions.shift()?.[0];
    let previous = current;
    const client = records.shift();
    let resumed = false;
    if (client) {
      const metadata = assertOwnedClient(client, manifest, state);
      const stages = state.versions[metadata.secretVersionId];
      if (!stages) throw new Error("Managed secret version is missing");
      if (!stages.includes("AWSCURRENT") || stages.includes("AWSPENDING")) {
        if (!stages.includes("AWSPENDING"))
          throw new Error("Managed secret version cannot be promoted");
        await secrets.promote(metadata.secretVersionId, current);
        resumed = true;
        previous = metadata.secretVersionId;
      }
      if (!operation.rotate || metadata.operationId === operation.id) {
        return {
          action: resumed ? "resumed" : "unchanged",
          clientId: manifest.clientId,
          versionId: metadata.secretVersionId,
        };
      }
    } else if (current) {
      throw new Error("Refusing to replace an unmanaged current secret");
    }

    const versionId = randomUUID();
    const secret = randomBytes(32).toString("base64url");
    await secrets.putPending(versionId, { client_id: manifest.clientId, client_secret: secret });
    const metadata: ManagedMetadata = {
      managedBy,
      repository: manifest.repository,
      environment: manifest.environment,
      secretArn: state.arn,
      secretVersionId: versionId,
      operationId: operation.id,
    };
    await database.transaction(async (tx) => {
      if (client) {
        await tx
          .update(oauthClients)
          .set({ clientSecret: hashOAuthClientSecret(secret), metadata })
          .where(eq(oauthClients.id, client.id));
      } else {
        await tx.insert(oauthClients).values({
          clientId: manifest.clientId,
          clientSecret: hashOAuthClientSecret(secret),
          name: manifest.name,
          userId: null,
          referenceId: manifest.referenceId,
          redirectUris: [...manifest.redirectUris],
          scopes: [...manifest.scopes],
          grantTypes: [...manifest.grantTypes],
          responseTypes: [...manifest.responseTypes],
          tokenEndpointAuthMethod: "client_secret_basic",
          type: "web",
          disabled: false,
          skipConsent: true,
          requirePKCE: true,
          public: false,
          metadata,
        });
      }
    });
    await secrets.promote(versionId, previous);
    return { action: client ? "rotated" : "created", clientId: manifest.clientId, versionId };
  } finally {
    await database.execute(
      sql`select pg_advisory_unlock(hashtextextended(${manifest.referenceId}, 0))`,
    );
  }
}
