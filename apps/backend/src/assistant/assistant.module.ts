import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";

import { AssistantKnowledgeModule } from "../assistant-knowledge/assistant-knowledge.module";
import { AuthorizationModule } from "../authorization/authorization.module";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
import { ExperimentModule } from "../experiments/experiment.module";
import { MacroModule } from "../macros/macro.module";
import { ProtocolModule } from "../protocols/protocol.module";
import { SearchModule } from "../search/search.module";
import { WorkbookModule } from "../workbooks/workbook.module";
import { AssistantModelService } from "./core/assistant-model.service";
import { AssistantToolService } from "./core/assistant-tool.service";
import { AssistantRepository } from "./core/assistant.repository";
import { AssistantService } from "./core/assistant.service";
import { AssistantController } from "./presentation/assistant.controller";

@Module({
  imports: [
    HttpModule,
    AnalyticsModule,
    AssistantKnowledgeModule,
    AuthorizationModule,
    DatabricksModule,
    ExperimentModule,
    MacroModule,
    ProtocolModule,
    SearchModule,
    WorkbookModule,
  ],
  controllers: [AssistantController],
  providers: [AssistantRepository, AssistantModelService, AssistantToolService, AssistantService],
})
export class AssistantModule {}
