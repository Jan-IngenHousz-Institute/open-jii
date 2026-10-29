export const instrumentTrackingClient = {
  clientId: "jii-instrument-tracking-prod",
  name: "Instrument tracking",
  repository: "Jan-IngenHousz-Institute/jii-instrument-tracking",
  referenceId: "repo:Jan-IngenHousz-Institute/jii-instrument-tracking:environment:prod",
  redirectUris: ["https://assets.openjii.org/api/auth/oauth2/callback/openjii"],
  scopes: ["openid", "profile", "email", "offline_access"],
  grantTypes: ["authorization_code", "refresh_token"],
  responseTypes: ["code"],
  environment: "prod",
  region: "eu-central-1",
  sourceRole: "ecs-task-role-oidc-client-provisioner-prod",
  secretId: "jii/instrument-tracking/prod/oidc",
} as const;

export type ManagedClientManifest = typeof instrumentTrackingClient & {
  sourceAccount: string;
  targetRole: string;
  secretArnPrefix: string;
};

export function resolveManagedClient(
  sourceAccount: string | undefined,
  targetRole: string | undefined,
): ManagedClientManifest {
  const target = /^arn:aws:iam::(\d{12}):role\/jii-instrument-tracking-prod-oidc-provisioner$/.exec(
    targetRole ?? "",
  );
  if (!sourceAccount || !/^\d{12}$/.test(sourceAccount) || !target || !targetRole)
    throw new Error("Managed AWS account configuration is required");
  return {
    ...instrumentTrackingClient,
    sourceAccount,
    targetRole,
    secretArnPrefix: `arn:aws:secretsmanager:${instrumentTrackingClient.region}:${target[1]}:secret:${instrumentTrackingClient.secretId}-`,
  };
}
export const managedBy = "openjii-oidc-provisioner/v1";
