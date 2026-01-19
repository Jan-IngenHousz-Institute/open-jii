import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { createDatabaseWithCredentials, db } from "@repo/database";

import { AwsModule } from "../modules/aws/aws.module";
import { AwsSecretsManagerService } from "../modules/aws/services/secrets-manager/secrets-manager.service";

@Global()
@Module({
  imports: [AwsModule],
  providers: [
    {
      provide: "DATABASE",
      useFactory: async (
        secretsManager: AwsSecretsManagerService,
        configService: ConfigService,
      ) => {
        const secretArn = configService.get<string>("DB_SECRET_ARN");

        if (!secretArn) {
          console.log("DB_SECRET_ARN not configured, using default database instance");
          return db;
        }

        try {
          // Try to get fresh credentials from AWS Secrets Manager
          const credentials = await secretsManager.getDatabaseCredentials(secretArn);

          console.log("Using database instance with fresh credentials from Secrets Manager");
          return createDatabaseWithCredentials(credentials);
        } catch (error) {
          console.error("Failed to fetch database credentials from Secrets Manager:", error);
          console.log("Falling back to default database instance");
          return db;
        }
      },
      inject: [AwsSecretsManagerService, ConfigService],
    },
  ],
  exports: ["DATABASE"],
})
export class DatabaseModule {}
