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
