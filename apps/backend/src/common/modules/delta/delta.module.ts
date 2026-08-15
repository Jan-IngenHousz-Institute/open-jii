import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";

import { DeltaConfigService } from "./services/config/delta-config.service";
import { DeltaSharingService } from "./services/sharing/delta-sharing.service";

/**
 * Delta Sharing protocol client. Resolves a shared table to pre-signed
 * parquet URLs; knows nothing about the engine that reads them.
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  providers: [DeltaConfigService, DeltaSharingService],
  exports: [DeltaSharingService],
})
export class DeltaModule {}
