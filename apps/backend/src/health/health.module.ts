import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { AwsAdapter } from "../common/modules/aws/aws.adapter";
import { AwsModule } from "../common/modules/aws/aws.module";
import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
import { EmailAdapter } from "../common/modules/email/services/email.adapter";
import { EmailModule } from "../common/modules/email/services/email.module";
import { DatabaseHealthIndicator } from "./application/indicators/database.indicator";
import { DatabricksHealthIndicator } from "./application/indicators/databricks.indicator";
import { EmailHealthIndicator } from "./application/indicators/email.indicator";
import { IotHealthIndicator } from "./application/indicators/iot.indicator";
import { DependencyHealthService } from "./application/services/dependency-health.service";
import { HEALTH_AWS_PORT } from "./core/ports/aws.port";
import { HEALTH_DATABRICKS_PORT } from "./core/ports/databricks.port";
import { HEALTH_EMAIL_PORT } from "./core/ports/email.port";
import { HealthController } from "./presentation/health.controller";

@Module({
  imports: [TerminusModule, AwsModule, DatabricksModule, EmailModule],
  controllers: [HealthController],
  providers: [
    DatabaseHealthIndicator,
    DatabricksHealthIndicator,
    EmailHealthIndicator,
    IotHealthIndicator,
    DependencyHealthService,
    {
      provide: HEALTH_AWS_PORT,
      useExisting: AwsAdapter,
    },
    {
      provide: HEALTH_DATABRICKS_PORT,
      useExisting: DatabricksAdapter,
    },
    {
      provide: HEALTH_EMAIL_PORT,
      useExisting: EmailAdapter,
    },
  ],
})
export class HealthModule {}
