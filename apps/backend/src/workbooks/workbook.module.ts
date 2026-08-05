import { Module } from "@nestjs/common";

import { AnalyticsAdapter } from "../common/modules/analytics/analytics.adapter";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
import { MacroModule } from "../macros/macro.module";
import { ProtocolRepository } from "../protocols/core/repositories/protocol.repository";
import { CreateWorkbookUseCase } from "./application/use-cases/create-workbook/create-workbook";
import { DeleteWorkbookUseCase } from "./application/use-cases/delete-workbook/delete-workbook";
import { GetWorkbookVersionUseCase } from "./application/use-cases/get-workbook-version/get-workbook-version";
import { GetWorkbookUseCase } from "./application/use-cases/get-workbook/get-workbook";
import { IsWorkbookUpgradableUseCase } from "./application/use-cases/is-workbook-upgradable/is-workbook-upgradable";
import { ListWorkbookVersionsUseCase } from "./application/use-cases/list-workbook-versions/list-workbook-versions";
import { ListWorkbooksUseCase } from "./application/use-cases/list-workbooks/list-workbooks";
import { PublishVersionUseCase } from "./application/use-cases/publish-version/publish-version";
import { UpdateWorkbookUseCase } from "./application/use-cases/update-workbook/update-workbook";
import { WORKBOOK_ANALYTICS_PORT } from "./core/ports/analytics.port";
import { WorkbookVersionRepository } from "./core/repositories/workbook-version.repository";
import { WorkbookRepository } from "./core/repositories/workbook.repository";
import { WorkbookController } from "./presentation/workbook.controller";

@Module({
  imports: [AnalyticsModule, MacroModule],
  controllers: [WorkbookController],
  providers: [
    { provide: WORKBOOK_ANALYTICS_PORT, useExisting: AnalyticsAdapter },
    WorkbookRepository,
    WorkbookVersionRepository,
    ProtocolRepository,
    CreateWorkbookUseCase,
    GetWorkbookUseCase,
    ListWorkbooksUseCase,
    UpdateWorkbookUseCase,
    DeleteWorkbookUseCase,
    PublishVersionUseCase,
    ListWorkbookVersionsUseCase,
    GetWorkbookVersionUseCase,
    IsWorkbookUpgradableUseCase,
  ],
  exports: [
    WorkbookRepository,
    WorkbookVersionRepository,
    PublishVersionUseCase,
    IsWorkbookUpgradableUseCase,
  ],
})
export class WorkbookModule {}
