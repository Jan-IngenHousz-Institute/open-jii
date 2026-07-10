import type { Result } from "../../../common/utils/fp-utils";

export const AWS_IOT_PORT = Symbol("AWS_IOT_PORT");

export interface CertificateResult {
  certificateId: string;
  certificateArn: string;
  certificatePem: string;
  privateKey: string;
}

export interface AwsIotPort {
  createThing(
    thingName: string,
    deviceClass: string,
    serialNumber: string,
    thingTypeName: string,
  ): Promise<Result<void>>;
  addThingToThingGroup(thingName: string, thingGroupName: string): Promise<Result<void>>;
  deleteThing(thingName: string): Promise<Result<void>>;
  createKeysAndCertificate(): Promise<Result<CertificateResult>>;
  attachThingPrincipal(thingName: string, certificateArn: string): Promise<Result<void>>;
  detachThingPrincipal(thingName: string, certificateArn: string): Promise<Result<void>>;
  attachPolicy(policyName: string, certificateArn: string): Promise<Result<void>>;
  updateCertificateStatus(
    certificateId: string,
    status: "ACTIVE" | "INACTIVE" | "REVOKED",
  ): Promise<Result<void>>;
}
