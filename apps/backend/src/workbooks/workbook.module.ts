import { Module } from "@nestjs/common";

import { CreateWorkbookUseCase } from "./application/use-cases/create-workbook/create-workbook";
import { DeleteWorkbookUseCase } from "./application/use-cases/delete-workbook/delete-workbook";
import { GetWorkbookVersionUseCase } from "./application/use-cases/get-workbook-version/get-workbook-version";
import { GetWorkbookUseCase } from "./application/use-cases/get-workbook/get-workbook";
import { ListWorkbookVersionsUseCase } from "./application/use-cases/list-workbook-versions/list-workbook-versions";
import { ListWorkbooksUseCase } from "./application/use-cases/list-workbooks/list-workbooks";
import { PublishVersionUseCase } from "./application/use-cases/publish-version/publish-version";
import { UpdateWorkbookUseCase } from "./application/use-cases/update-workbook/update-workbook";
import { WorkbookVersionRepository } from "./core/repositories/workbook-version.repository";
import { WorkbookRepository } from "./core/repositories/workbook.repository";
import { WorkbookController } from "./presentation/workbook.controller";

@Module({
  controllers: [WorkbookController],
  providers: [
    WorkbookRepository,
    WorkbookVersionRepository,
    CreateWorkbookUseCase,
    GetWorkbookUseCase,
    ListWorkbooksUseCase,
    UpdateWorkbookUseCase,
    DeleteWorkbookUseCase,
    PublishVersionUseCase,
    ListWorkbookVersionsUseCase,
    GetWorkbookVersionUseCase,
  ],
  exports: [WorkbookRepository, PublishVersionUseCase],
})
export class WorkbookModule {}
