import {
  IoTClient,
  CreateThingCommand,
  DeleteThingCommand,
  AddThingToThingGroupCommand,
  CreateKeysAndCertificateCommand,
  AttachThingPrincipalCommand,
  DetachThingPrincipalCommand,
  AttachPolicyCommand,
  UpdateCertificateCommand,
  DescribeEndpointCommand,
} from "@aws-sdk/client-iot";
import { Injectable } from "@nestjs/common";

import { ErrorCodes } from "../../../../utils/error-codes";
import { AppError, Result, tryCatch } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";
import type {
  CreateThingInput,
  CreatedThing,
  CertificateResult,
  CertificateStatus,
} from "./iot.types";

@Injectable()
export class AwsIotService {
  private readonly iotClient: IoTClient;

  constructor(private readonly awsConfig: AwsConfigService) {
    this.iotClient = new IoTClient({ region: this.awsConfig.region });
  }

  async createThing(input: CreateThingInput): Promise<Result<CreatedThing>> {
    return tryCatch(
      async () => {
        const response = await this.iotClient.send(
          new CreateThingCommand({
            thingName: input.thingName,
            thingTypeName: this.awsConfig.deviceThingTypeName,
            attributePayload: { attributes: input.attributes },
          }),
        );

        if (!response.thingName || !response.thingArn) {
          throw AppError.internal(
            "AWS IoT CreateThing returned an incomplete response",
            ErrorCodes.AWS_IOT_CREATE_THING_FAILED,
          );
        }

        await this.iotClient.send(
          new AddThingToThingGroupCommand({
            thingName: response.thingName,
            thingGroupName: this.awsConfig.deviceThingGroupName,
          }),
        );

        return { thingName: response.thingName, thingArn: response.thingArn };
      },
      (error) => this.mapError(error, ErrorCodes.AWS_IOT_CREATE_THING_FAILED),
    );
  }

  async deleteThing(thingName: string): Promise<Result<void>> {
    return tryCatch(
      async () => {
        await this.iotClient.send(new DeleteThingCommand({ thingName }));
      },
      (error) => this.mapError(error, ErrorCodes.AWS_IOT_DELETE_THING_FAILED),
    );
  }

  async createKeysAndCertificate(): Promise<Result<CertificateResult>> {
    return tryCatch(
      async () => {
        const response = await this.iotClient.send(
          new CreateKeysAndCertificateCommand({ setAsActive: true }),
        );

        const { certificateId, certificateArn, certificatePem } = response;
        const publicKey = response.keyPair?.PublicKey;
        const privateKey = response.keyPair?.PrivateKey;

        if (!certificateId || !certificateArn || !certificatePem || !publicKey || !privateKey) {
          throw AppError.internal(
            "AWS IoT CreateKeysAndCertificate returned an incomplete response",
            ErrorCodes.AWS_IOT_CREATE_CERT_FAILED,
          );
        }

        return { certificateId, certificateArn, certificatePem, publicKey, privateKey };
      },
      (error) => this.mapError(error, ErrorCodes.AWS_IOT_CREATE_CERT_FAILED),
    );
  }

  async attachThingPrincipal(thingName: string, certificateArn: string): Promise<Result<void>> {
    return tryCatch(
      async () => {
        await this.iotClient.send(
          new AttachThingPrincipalCommand({ thingName, principal: certificateArn }),
        );
      },
      (error) => this.mapError(error, ErrorCodes.AWS_IOT_ATTACH_PRINCIPAL_FAILED),
    );
  }

  async detachThingPrincipal(thingName: string, certificateArn: string): Promise<Result<void>> {
    return tryCatch(
      async () => {
        await this.iotClient.send(
          new DetachThingPrincipalCommand({ thingName, principal: certificateArn }),
        );
      },
      (error) => this.mapError(error, ErrorCodes.AWS_IOT_ATTACH_PRINCIPAL_FAILED),
    );
  }

  async attachPolicy(policyName: string, certificateArn: string): Promise<Result<void>> {
    return tryCatch(
      async () => {
        await this.iotClient.send(new AttachPolicyCommand({ policyName, target: certificateArn }));
      },
      (error) => this.mapError(error, ErrorCodes.AWS_IOT_ATTACH_CERT_POLICY_FAILED),
    );
  }

  // The account's MQTT broker host. ATS is the endpoint devices must use with
  // the Amazon Root CA bundle handed out alongside the certificate.
  async describeDataEndpoint(): Promise<Result<string>> {
    return tryCatch(
      async () => {
        const response = await this.iotClient.send(
          new DescribeEndpointCommand({ endpointType: "iot:Data-ATS" }),
        );

        if (!response.endpointAddress) {
          throw AppError.internal(
            "AWS IoT returned no endpoint address",
            ErrorCodes.AWS_IOT_DESCRIBE_ENDPOINT_FAILED,
          );
        }

        return response.endpointAddress;
      },
      (error) => this.mapError(error, ErrorCodes.AWS_IOT_DESCRIBE_ENDPOINT_FAILED),
    );
  }

  async updateCertificateStatus(
    certificateId: string,
    status: CertificateStatus,
  ): Promise<Result<void>> {
    return tryCatch(
      async () => {
        await this.iotClient.send(
          new UpdateCertificateCommand({ certificateId, newStatus: status }),
        );
      },
      (error) => this.mapError(error, ErrorCodes.AWS_IOT_UPDATE_CERT_FAILED),
    );
  }

  private mapError(error: unknown, code: ErrorCodes): AppError {
    if (error instanceof AppError) {
      return error;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return AppError.internal(message, code);
  }
}
