export interface CreateThingInput {
  thingName: string;
  attributes: Record<string, string>;
}

export interface CreatedThing {
  thingName: string;
  thingArn: string;
}

export interface CertificateResult {
  certificateId: string;
  certificateArn: string;
  certificatePem: string;
  publicKey: string;
  privateKey: string;
}

export type CertificateStatus = "ACTIVE" | "INACTIVE" | "REVOKED";

/**
 * Broker connectivity of one thing from the fleet index. `lastSeenAt` is the
 * ISO timestamp of the last connectivity state change; null when the index has
 * never recorded one.
 */
export interface ThingConnectivity {
  thingName: string;
  connected: boolean;
  lastSeenAt: string | null;
}
