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
  SearchIndexCommand,
} from "@aws-sdk/client-iot";
import { Injectable } from "@nestjs/common";

import { ErrorCodes } from "../../../../utils/error-codes";
import { AppError, Result, success, tryCatch } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";
import type {
  CreateThingInput,
  CreatedThing,
  CertificateResult,
  CertificateStatus,
  ThingConnectivity,
} from "./iot.types";

// The fleet-index query string is capped at 1000 characters, so thing names
// are batched by accumulated length with a generous count ceiling.
const SEARCH_INDEX_MAX_QUERY_CHARS = 900;
const SEARCH_INDEX_MAX_TERMS = 50;

@Injectable()
export class AwsIotService {
  private readonly iotClient: IoTClient;
  private cachedDataEndpoint: string | null = null;

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
  // the Amazon Root CA bundle handed out alongside the certificate. The value is
  // constant per account/region and DescribeEndpoint is throttled, so a resolved
  // endpoint is cached for the process lifetime; failures are never cached.
  async describeDataEndpoint(): Promise<Result<string>> {
    if (this.cachedDataEndpoint !== null) {
      return success(this.cachedDataEndpoint);
    }

    const result = await tryCatch(
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

    if (result.isSuccess()) {
      this.cachedDataEndpoint = result.value;
    }

    return result;
  }

  // Live broker connectivity from the fleet index (thingConnectivity STATUS
  // indexing). Things absent from the response (not yet indexed, or the index
  // still building after first enable) are simply missing from the map.
  async searchThingsConnectivity(
    thingNames: string[],
  ): Promise<Result<Map<string, ThingConnectivity>>> {
    return tryCatch(
      async () => {
        const connectivity = new Map<string, ThingConnectivity>();

        for (const chunk of this.chunkThingNames(thingNames)) {
          const queryString = chunk.map((name) => `thingName:${name}`).join(" OR ");
          let nextToken: string | undefined;

          do {
            const response = await this.iotClient.send(
              new SearchIndexCommand({ queryString, nextToken }),
            );

            for (const thing of response.things ?? []) {
              if (!thing.thingName) {
                continue;
              }

              connectivity.set(thing.thingName, {
                thingName: thing.thingName,
                connected: thing.connectivity?.connected ?? false,
                lastSeenAt:
                  thing.connectivity?.timestamp !== undefined && thing.connectivity.timestamp > 0
                    ? new Date(thing.connectivity.timestamp).toISOString()
                    : null,
              });
            }

            nextToken = response.nextToken;
          } while (nextToken !== undefined);
        }

        return connectivity;
      },
      (error) => this.mapError(error, ErrorCodes.AWS_IOT_SEARCH_INDEX_FAILED),
    );
  }

  private chunkThingNames(thingNames: string[]): string[][] {
    const chunks: string[][] = [];
    let current: string[] = [];
    let currentLength = 0;

    for (const name of thingNames) {
      const termLength = name.length + 14; // "thingName:" + " OR "
      if (
        current.length > 0 &&
        (current.length >= SEARCH_INDEX_MAX_TERMS ||
          currentLength + termLength > SEARCH_INDEX_MAX_QUERY_CHARS)
      ) {
        chunks.push(current);
        current = [];
        currentLength = 0;
      }

      current.push(name);
      currentLength += termLength;
    }

    if (current.length > 0) {
      chunks.push(current);
    }

    return chunks;
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
