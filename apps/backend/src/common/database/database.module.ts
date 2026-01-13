import { Global, Module } from "@nestjs/common";

import { createDatabaseWithCredentials, db } from "@repo/database";

import { getDatabaseCredentials } from "../config/database.config";

@Global()
@Module({
  providers: [
    {
      provide: "DATABASE",
      useFactory: async () => {
        // Try to get fresh credentials from AWS Secrets Manager
        const credentials = await getDatabaseCredentials();

        if (credentials) {
          console.log("Using database instance with fresh credentials from Secrets Manager");
          return createDatabaseWithCredentials(credentials);
        }

        // Fallback to default database instance (uses environment variables)
        console.log("Using default database instance with environment credentials");
        return db;
      },
    },
  ],
  exports: ["DATABASE"],
})
export class DatabaseModule { }
