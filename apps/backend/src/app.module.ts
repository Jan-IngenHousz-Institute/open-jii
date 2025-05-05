import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import databaseConfig from "./config/database.config";
import { DatabaseModule } from "./database/database.module";
import { ExperimentModule } from "./experiments/experiment.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    DatabaseModule,
    ExperimentModule,
    HealthModule,
  ],
})
export class AppModule {}
