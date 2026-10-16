import { Module } from "@nestjs/common";

import { ExperimentModule } from "../experiments/experiment.module";
import { MacroModule } from "../macros/macro.module";
import { ProtocolModule } from "../protocols/protocol.module";
import { WorkbookModule } from "../workbooks/workbook.module";
import { ListRecentlyOpenedUseCase } from "./application/use-cases/list-recently-opened/list-recently-opened";
import { RecordVisitUseCase } from "./application/use-cases/record-visit/record-visit";
import { VisitRepository } from "./core/repositories/visit.repository";
import { VisitController } from "./presentation/visit.controller";

/** The resource modules are imported so the list reads each type through its own access scope. */
@Module({
  imports: [ExperimentModule, ProtocolModule, MacroModule, WorkbookModule],
  controllers: [VisitController],
  providers: [VisitRepository, RecordVisitUseCase, ListRecentlyOpenedUseCase],
})
export class VisitModule {}
