import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";

import { DatabricksService } from "./databricks.service";

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  providers: [DatabricksService],
  exports: [DatabricksService],
})
export class DatabricksModule {}
