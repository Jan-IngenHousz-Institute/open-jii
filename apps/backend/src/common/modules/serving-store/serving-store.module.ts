import { Module } from "@nestjs/common";

import { ServingStoreClientService } from "./services/client/client.service";
import { ServingStoreConfigService } from "./services/config/config.service";
import { ServingStoreAdapter } from "./serving-store.adapter";

@Module({
  providers: [ServingStoreConfigService, ServingStoreClientService, ServingStoreAdapter],
  exports: [ServingStoreAdapter],
})
export class ServingStoreModule {}
