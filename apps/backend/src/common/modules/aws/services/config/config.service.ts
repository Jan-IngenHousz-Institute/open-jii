import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ErrorCodes } from "../../../../utils/error-codes";
import { AwsConfig, awsConfigSchema } from "./config.types";

@Injectable()
export class AwsConfigService {
  private readonly logger = new Logger(AwsConfigService.name);
  private readonly config: AwsConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  /**
   * Loads AWS configuration from environment variables
   */
  private loadConfig(): AwsConfig {
    this.logger.debug({
      msg: "Loading AWS configuration",
      operation: "loadConfig",
    });
    return {
      region: this.configService.getOrThrow<string>("aws.region"),
      placeIndexName: this.configService.getOrThrow<string>("aws.location.placeIndexName"),
      cognitoIdentityPoolId: this.configService.getOrThrow<string>("aws.cognito.identityPoolId"),
      cognitoDeveloperProviderName: this.configService.getOrThrow<string>(
        "aws.cognito.developerProviderName",
      ),
      lambda: {
        macroRunnerPythonFunctionName: this.configService.getOrThrow<string>(
          "aws.lambda.macroRunnerPythonFunctionName",
        ),
        macroRunnerJavascriptFunctionName: this.configService.getOrThrow<string>(
          "aws.lambda.macroRunnerJavascriptFunctionName",
        ),
        macroRunnerRFunctionName: this.configService.getOrThrow<string>(
          "aws.lambda.macroRunnerRFunctionName",
        ),
      },
    };
  }

  /**
   * Validates the loaded configuration
   */
  private validateConfig(): void {
    try {
      awsConfigSchema.parse(this.config);
      this.logger.debug({
        msg: "AWS configuration validated successfully",
        operation: "validateConfig",
        status: "success",
      });
    } catch (error) {
      this.logger.error({
        msg: "Invalid AWS configuration",
        errorCode: ErrorCodes.AWS_CONFIG_INVALID,
        operation: "validateConfig",
        error,
      });
      throw new Error(
        `AWS configuration validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Gets the AWS region
   */
  get region(): string {
    return this.config.region;
  }

  /**
   * Gets the place index name for AWS Location Service
   */
  get placeIndexName(): string {
    return this.config.placeIndexName;
  }

  /**
   * Gets the Cognito Identity Pool ID
   */
  get cognitoIdentityPoolId(): string {
    return this.config.cognitoIdentityPoolId;
  }

  /**
   * Gets the Cognito developer provider name
   */
  get cognitoDeveloperProviderName(): string {
    return this.config.cognitoDeveloperProviderName;
  }
  /*
   * Gets the Lambda function name for macro runner by language
   */
  get lambdaConfig() {
    return this.config.lambda;
  }
}
