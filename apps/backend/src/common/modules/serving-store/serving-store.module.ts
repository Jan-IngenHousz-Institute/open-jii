import { Module } from "@nestjs/common";

import { ServingStoreClientService } from "./services/client/client.service";
import { ServingStoreCopierClientService } from "./services/client/copier-client.service";
import { ServingStoreConfigService } from "./services/config/config.service";
import { ServingStoreCopiesAdapter } from "./serving-store-copies.adapter";
import { ServingStoreAdapter } from "./serving-store.adapter";

@Module({
  providers: [
    ServingStoreConfigService,
    ServingStoreClientService,
    ServingStoreCopierClientService,
    ServingStoreAdapter,
    ServingStoreCopiesAdapter,
  ],
  exports: [ServingStoreAdapter, ServingStoreCopiesAdapter],
})
export class ServingStoreModule {}
