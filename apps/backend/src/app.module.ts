import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import databaseConfig from "./common/config/database.config";
import databricksConfig from "./common/config/databricks.config";
import { DatabaseModule } from "./common/database/database.module";
import { ExperimentModule } from "./experiments/experiment.module";
import { FlowModule } from "./experiments/flows/flow.module";
import { HealthModule } from "./health/health.module";
import { ProtocolModule } from "./protocols/protocol.module";
import { UserModule } from "./users/user.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, databricksConfig],
    }),
    DatabaseModule,
    ExperimentModule,
    FlowModule,
    ProtocolModule,
    UserModule,
    HealthModule,
  ],
})
export class AppModule {}
