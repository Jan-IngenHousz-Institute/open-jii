import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import databaseConfig from "./config/database.config";
import { DatabaseModule } from "./database/database.module";
import { ExperimentModule } from "./experiments/experiment.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    DatabaseModule,
    ExperimentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
