import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../common/database/database.module";
// External dependencies
import { ExperimentRepository } from "../core/repositories/experiment.repository";
import { CreateFlowWithStepsUseCase } from "./application/use-cases/create-flow-with-steps/create-flow-with-steps";
// Use Cases
import { GetFlowByExperimentUseCase } from "./application/use-cases/get-flow-by-experiment/get-flow-by-experiment";
import { ListFlowsUseCase } from "./application/use-cases/list-flows/list-flows";
import { UpdateFlowWithStepsUseCase } from "./application/use-cases/update-flow-with-steps/update-flow-with-steps";
import { FlowStepRepository } from "./core/repositories/flow-step.repository";
// Repositories
import { FlowRepository } from "./core/repositories/flow.repository";
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
    CreateFlowWithStepsUseCase,
    GetFlowByExperimentUseCase,
    ListFlowsUseCase,
    UpdateFlowWithStepsUseCase,
  ],
  controllers: [FlowController],
  exports: [
    FlowRepository,
    FlowStepRepository,
    // Export use cases that might be used by other modules
    GetFlowByExperimentUseCase,
  ],
})
export class FlowModule {}
