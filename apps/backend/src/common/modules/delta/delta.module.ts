import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { DeltaAdapter } from "./delta.adapter";
import { DeltaConfigService } from "./services/config/config.service";
import { DeltaDataService } from "./services/data/data.service";
import { DeltaSchemasService } from "./services/schemas/schemas.service";
import { DeltaSharesService } from "./services/shares/shares.service";
import { DeltaTablesService } from "./services/tables/tables.service";

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    DeltaConfigService,
    DeltaSharesService,
    DeltaSchemasService,
    DeltaTablesService,
    DeltaDataService,
    DeltaAdapter,
  ],
  exports: [DeltaAdapter],
})
export class DeltaModule {}
