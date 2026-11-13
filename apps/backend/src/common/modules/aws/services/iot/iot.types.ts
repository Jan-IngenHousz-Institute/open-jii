export interface CreateThingInput {
  thingName: string;
  attributes: Record<string, string>;
}

export interface CreatedThing {
  thingName: string;
  thingArn: string;
  /**
   * The thing existed before this call and was adopted rather than created.
   * Callers must not delete it when a later step fails: it is not theirs.
   */
  adopted: boolean;
}

export interface CertificateResult {
  certificateId: string;
  certificateArn: string;
  certificatePem: string;
  publicKey: string;
  privateKey: string;
}

/**
 * What ensuring a thing's deviceLocationId attribute did. "conflict" means a
 * differing value was kept; "unsupported" that the thing name has no id.
 */
export type DeviceLocationIdOutcome = "unchanged" | "set" | "conflict" | "unsupported";

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
