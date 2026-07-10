import {
  AddThingToThingGroupCommand,
  AttachPolicyCommand,
  AttachThingPrincipalCommand,
  CreateKeysAndCertificateCommand,
  CreateThingCommand,
  DeleteThingCommand,
  DetachThingPrincipalCommand,
  IoTClient,
  UpdateCertificateCommand,
} from "@aws-sdk/client-iot";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ErrorCodes } from "../../../common/utils/error-codes";
import { AppError, tryCatch } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import type { AwsIotPort, CertificateResult } from "../../core/ports/aws-iot.port";

const mapError = (error: unknown): AppError => {
  const message = error instanceof Error ? error.message : "Unknown AWS IoT error";
  return AppError.internal(message, ErrorCodes.AWS_OPERATION_FAILED);
};

@Injectable()
export class AwsIotCoreService implements AwsIotPort {
  private readonly client: IoTClient;

  constructor(configService: ConfigService) {
    this.client = new IoTClient({ region: configService.get<string>("aws.region") });
  }

  async createThing(
    thingName: string,
    deviceClass: string,
    serialNumber: string,
    thingTypeName: string,
  ): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.client.send(
        new CreateThingCommand({
          thingName,
          thingTypeName,
          attributePayload: {
            attributes: { device_class: deviceClass, serial_number: serialNumber },
          },
        }),
      );
    }, mapError);
  }

  async addThingToThingGroup(thingName: string, thingGroupName: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.client.send(new AddThingToThingGroupCommand({ thingName, thingGroupName }));
    }, mapError);
  }

  async deleteThing(thingName: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.client.send(new DeleteThingCommand({ thingName }));
    }, mapError);
  }

  async createKeysAndCertificate(): Promise<Result<CertificateResult>> {
    return tryCatch(async () => {
      const res = await this.client.send(
        new CreateKeysAndCertificateCommand({ setAsActive: true }),
      );
      const certificateId = res.certificateId;
      const certificateArn = res.certificateArn;
      const certificatePem = res.certificatePem;
      const privateKey = res.keyPair?.PrivateKey;

      if (!certificateId || !certificateArn || !certificatePem || !privateKey) {
        throw new Error("AWS IoT returned incomplete certificate data");
      }

      return { certificateId, certificateArn, certificatePem, privateKey };
    }, mapError);
  }

  async attachThingPrincipal(thingName: string, certificateArn: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.client.send(
        new AttachThingPrincipalCommand({ thingName, principal: certificateArn }),
      );
    }, mapError);
  }

  async detachThingPrincipal(thingName: string, certificateArn: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.client.send(
        new DetachThingPrincipalCommand({ thingName, principal: certificateArn }),
      );
    }, mapError);
  }

  async attachPolicy(policyName: string, certificateArn: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.client.send(new AttachPolicyCommand({ policyName, target: certificateArn }));
    }, mapError);
  }

  async updateCertificateStatus(
    certificateId: string,
    status: "ACTIVE" | "INACTIVE" | "REVOKED",
  ): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.client.send(new UpdateCertificateCommand({ certificateId, newStatus: status }));
    }, mapError);
  }
}
