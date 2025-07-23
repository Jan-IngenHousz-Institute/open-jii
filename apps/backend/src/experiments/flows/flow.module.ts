import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../common/database/database.module";
// External dependencies
import { ExperimentRepository } from "../core/repositories/experiment.repository";
import { CreateFlowStepUseCase } from "./application/use-cases/create-flow-step/create-flow-step";
// Use Cases
import { CreateFlowUseCase } from "./application/use-cases/create-flow/create-flow";
import { GetFlowUseCase } from "./application/use-cases/get-flow/get-flow";
import { ListFlowsUseCase } from "./application/use-cases/list-flows/list-flows";
import { FlowStepRepository } from "./core/repositories/flow-step.repository";
// Repositories
import { FlowRepository } from "./core/repositories/flow.repository";
import { ExperimentFlowController } from "./presentation/experiment-flow.controller";
// Controllers
import { FlowController } from "./presentation/flow.controller";

@Module({
  imports: [DatabaseModule],
  providers: [
    // External dependencies
    ExperimentRepository,

    // Repositories
    FlowRepository,
    FlowStepRepository,

    // Use Cases
    CreateFlowUseCase,
    GetFlowUseCase,
    ListFlowsUseCase,
    CreateFlowStepUseCase,
  ],
  controllers: [FlowController, ExperimentFlowController],
  exports: [
    FlowRepository,
    FlowStepRepository,
    // Export use cases that might be used by other modules
    GetFlowUseCase,
  ],
})
export class FlowModule {}
