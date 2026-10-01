import { Controller, Inject, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { FEATURE_FLAGS } from "@repo/analytics";
import { iotCalibrationContract } from "@repo/api/domains/iot/calibration/iot-calibration.contract";

import { CanAccess } from "../../authorization/can-access.decorator";
import { CanCreateInOrg } from "../../authorization/can-create-in-org.guard";
import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { AppError } from "../../common/utils/fp-utils";
import { throwOrpcError, throwOrpcFailure } from "../../common/utils/orpc-fp";
import { SetVisibilityUseCase } from "../../visibility/application/use-cases/set-visibility/set-visibility";
import { CreateCalibrationDefinitionUseCase } from "../application/use-cases/create-calibration-definition/create-calibration-definition";
import { DeleteCalibrationDefinitionUseCase } from "../application/use-cases/delete-calibration-definition/delete-calibration-definition";
import { GetCalibrationDefinitionUseCase } from "../application/use-cases/get-calibration-definition/get-calibration-definition";
import { ListCalibrationDefinitionsUseCase } from "../application/use-cases/list-calibration-definitions/list-calibration-definitions";
import { UpdateCalibrationDefinitionUseCase } from "../application/use-cases/update-calibration-definition/update-calibration-definition";
import { ANALYTICS_PORT } from "../core/ports/analytics.port";
import type { AnalyticsPort } from "../core/ports/analytics.port";

@Controller()
export class IotCalibrationController {
  private readonly logger = new Logger(IotCalibrationController.name);

  constructor(
    @Inject(ANALYTICS_PORT)
    private readonly analyticsPort: AnalyticsPort,
    private readonly createCalibrationDefinitionUseCase: CreateCalibrationDefinitionUseCase,
    private readonly listCalibrationDefinitionsUseCase: ListCalibrationDefinitionsUseCase,
    private readonly getCalibrationDefinitionUseCase: GetCalibrationDefinitionUseCase,
    private readonly deleteCalibrationDefinitionUseCase: DeleteCalibrationDefinitionUseCase,
    private readonly updateCalibrationDefinitionUseCase: UpdateCalibrationDefinitionUseCase,
    private readonly setVisibilityUseCase: SetVisibilityUseCase,
  ) {}

  @Implement(iotCalibrationContract.listCalibrationDefinitions)
  listCalibrationDefinitions(@Session() session: UserSession) {
    return implement(iotCalibrationContract.listCalibrationDefinitions).handler(
      async ({ input }) => {
        await this.requireCalibration(session, "listCalibrationDefinitions");

        const result = await this.listCalibrationDefinitionsUseCase.execute(
          session.user.id,
          input.family,
        );

        if (result.isSuccess()) {
          return formatDatesList(
            result.value.map(
              ({
                captureProcedure: _p,
                script: _s,
                outputSchema: _o,
                minFirmwareVersion: _f,
                ...summary
              }) => summary,
            ),
          );
        }

        return throwOrpcFailure(result, this.logger, "listCalibrationDefinitions");
      },
    );
  }

  @CanAccess({ resource: "calibration_definition", action: "read", param: "definitionId" })
  @Implement(iotCalibrationContract.getCalibrationDefinition)
  getCalibrationDefinition(@Session() session: UserSession) {
    return implement(iotCalibrationContract.getCalibrationDefinition).handler(async ({ input }) => {
      await this.requireCalibration(session, "getCalibrationDefinition");

      const result = await this.getCalibrationDefinitionUseCase.execute(
        input.definitionId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "getCalibrationDefinition");
    });
  }

  @CanCreateInOrg()
  @Implement(iotCalibrationContract.createCalibrationDefinition)
  createCalibrationDefinition(@Session() session: UserSession) {
    return implement(iotCalibrationContract.createCalibrationDefinition).handler(
      async ({ input }) => {
        await this.requireCalibration(session, "createCalibrationDefinition");

        const result = await this.createCalibrationDefinitionUseCase.execute(
          input,
          session.user.id,
        );

        if (result.isSuccess()) {
          return formatDates(result.value);
        }

        return throwOrpcFailure(result, this.logger, "createCalibrationDefinition");
      },
    );
  }

  @CanAccess({ resource: "calibration_definition", action: "manage", param: "definitionId" })
  @Implement(iotCalibrationContract.updateCalibrationDefinition)
  updateCalibrationDefinition(@Session() session: UserSession) {
    return implement(iotCalibrationContract.updateCalibrationDefinition).handler(
      async ({ input }) => {
        await this.requireCalibration(session, "updateCalibrationDefinition");

        const { definitionId, ...changes } = input;
        const result = await this.updateCalibrationDefinitionUseCase.execute(
          definitionId,
          changes,
          session.user.id,
        );

        if (result.isSuccess()) {
          return formatDates(result.value);
        }

        return throwOrpcFailure(result, this.logger, "updateCalibrationDefinition");
      },
    );
  }

  // Publishing is manage-gated and one way; the shared use case owns the transition rules.
  @CanAccess({ resource: "calibration_definition", action: "manage", param: "definitionId" })
  @Implement(iotCalibrationContract.setCalibrationDefinitionVisibility)
  setCalibrationDefinitionVisibility(@Session() session: UserSession) {
    return implement(iotCalibrationContract.setCalibrationDefinitionVisibility).handler(
      async ({ input }) => {
        await this.requireCalibration(session, "setCalibrationDefinitionVisibility");

        const result = await this.setVisibilityUseCase.execute(
          "calibration_definition",
          input.definitionId,
          input.visibility,
        );

        if (result.isSuccess()) {
          return result.value;
        }

        return throwOrpcFailure(result, this.logger, "setCalibrationDefinitionVisibility");
      },
    );
  }

  @CanAccess({ resource: "calibration_definition", action: "manage", param: "definitionId" })
  @Implement(iotCalibrationContract.deleteCalibrationDefinition)
  deleteCalibrationDefinition(@Session() session: UserSession) {
    return implement(iotCalibrationContract.deleteCalibrationDefinition).handler(
      async ({ input }) => {
        await this.requireCalibration(session, "deleteCalibrationDefinition");

        const result = await this.deleteCalibrationDefinitionUseCase.execute(
          input.definitionId,
          session.user.id,
        );

        if (result.isSuccess()) {
          return;
        }

        return throwOrpcFailure(result, this.logger, "deleteCalibrationDefinition");
      },
    );
  }

  /** Calibration stays dark until PostHog targets someone, so every call is refused until then. */
  private async requireCalibration(session: UserSession, operation: string): Promise<void> {
    const isEnabled = await this.analyticsPort.isFeatureFlagEnabled(
      FEATURE_FLAGS.CALIBRATION,
      session.user,
    );

    if (!isEnabled) {
      throwOrpcError(
        AppError.forbidden("Calibration is currently disabled"),
        this.logger,
        operation,
      );
    }
  }
}
