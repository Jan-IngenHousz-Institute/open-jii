import {
  IoTClient,
  CreateThingCommand,
  DeleteThingCommand,
  AddThingToThingGroupCommand,
} from "@aws-sdk/client-iot";
import { Injectable } from "@nestjs/common";

import { ErrorCodes } from "../../../../utils/error-codes";
import { AppError, Result, tryCatch } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";
import type { CreateThingInput, CreatedThing } from "./iot.types";

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

  private mapError(error: unknown, code: ErrorCodes): AppError {
    if (error instanceof AppError) {
      return error;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return AppError.internal(message, code);
  }
}
