import { HttpModule, HttpService } from "@nestjs/axios";
import { Module } from "@nestjs/common";

import { DatabricksModule } from "../common/modules/databricks/databricks.module";
import { DatabricksConfigService } from "../common/modules/databricks/services/config/config.service";
import { DatabricksFilesService } from "../common/modules/databricks/services/files/files.service";
import { DatabricksSqlService } from "../common/modules/databricks/services/sql/sql.service";
import { AssistantKnowledgeService } from "./assistant-knowledge.service";
import { AssistantKnowledgeDatabricksAuthService } from "./infrastructure/assistant-knowledge-databricks-auth.service";
import { AssistantKnowledgeUploadService } from "./infrastructure/assistant-knowledge-upload.service";
import { AssistantKnowledgeStore } from "./infrastructure/assistant-knowledge.store";
import { DatabricksDocumentParser } from "./infrastructure/databricks-document-parser";
import { DatabricksGenieClient } from "./infrastructure/databricks-genie.client";
import { DocsRetriever } from "./infrastructure/docs-retriever";
import { AssistantKnowledgeController } from "./presentation/assistant-knowledge.controller";
import { PublicAssistantToolsController } from "./presentation/public-assistant-tools.controller";

@Module({
  imports: [HttpModule, DatabricksModule],
  controllers: [AssistantKnowledgeController, PublicAssistantToolsController],
  providers: [
    AssistantKnowledgeDatabricksAuthService,
    {
      provide: DatabricksFilesService,
      inject: [HttpService, DatabricksConfigService, AssistantKnowledgeDatabricksAuthService],
      useFactory: (
        http: HttpService,
        config: DatabricksConfigService,
        auth: AssistantKnowledgeDatabricksAuthService,
      ) => new DatabricksFilesService(http, config, auth),
    },
    {
      provide: DatabricksSqlService,
      inject: [HttpService, AssistantKnowledgeDatabricksAuthService, DatabricksConfigService],
      useFactory: (
        http: HttpService,
        auth: AssistantKnowledgeDatabricksAuthService,
        config: DatabricksConfigService,
      ) => new DatabricksSqlService(http, auth, config),
    },
    AssistantKnowledgeStore,
    AssistantKnowledgeUploadService,
    DocsRetriever,
    DatabricksDocumentParser,
    DatabricksGenieClient,
    AssistantKnowledgeService,
  ],
  exports: [AssistantKnowledgeService],
})
export class AssistantKnowledgeModule {}
