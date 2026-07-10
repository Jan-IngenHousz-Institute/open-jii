import type { IotCredentials } from "../../../common/modules/aws/services/cognito/cognito.types";
import type {
  CreateThingInput,
  CreatedThing,
} from "../../../common/modules/aws/services/iot/iot.types";
import type { IotUploadUrl } from "../../../common/modules/aws/services/s3/s3.types";
import type { Result } from "../../../common/utils/fp-utils";

export type { IotCredentials, IotUploadUrl, CreateThingInput, CreatedThing };

/**
 * Injection token for the AWS port
 */
export const AWS_PORT = Symbol("AWS_PORT");

/**
 * Port interface for AWS operations in the IoT domain
 */
export interface AwsPort {
  getIotCredentials(userId: string): Promise<Result<IotCredentials>>;
  getIotUploadUrl(experimentId: string): Promise<Result<IotUploadUrl>>;
  createThing(input: CreateThingInput): Promise<Result<CreatedThing>>;
  deleteThing(thingName: string): Promise<Result<void>>;
}
