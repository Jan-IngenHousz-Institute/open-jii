import { Module } from "@nestjs/common";

import { AnalyticsAdapter } from "../common/modules/analytics/analytics.adapter";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
import { ExperimentModule } from "../experiments/experiment.module";
import { IotModule } from "../iot/iot.module";
import { MacroModule } from "../macros/macro.module";
import { OrganizationModule } from "../organizations/organization.module";
import { ProtocolModule } from "../protocols/protocol.module";
import { WorkbookModule } from "../workbooks/workbook.module";
import { GlobalSearchUseCase } from "./application/use-cases/global-search/global-search";
import { ANALYTICS_PORT } from "./core/ports/analytics.port";
import { SearchController } from "./presentation/search.controller";

@Module({
  // Imported modules export the repositories the global-search use case composes.
  imports: [
    AnalyticsModule,
    ExperimentModule,
    ProtocolModule,
    MacroModule,
    WorkbookModule,
    IotModule,
    OrganizationModule,
  ],
  controllers: [SearchController],
  providers: [
    GlobalSearchUseCase,
    {
      provide: ANALYTICS_PORT,
      useExisting: AnalyticsAdapter,
    },
  ],
})
export class SearchModule {}
