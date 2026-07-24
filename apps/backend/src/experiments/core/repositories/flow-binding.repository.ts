import { Inject, Injectable, Logger } from "@nestjs/common";

import { eq, experiments } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { ErrorCodes } from "../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../common/utils/fp-utils";
import type { ExperimentDto } from "../models/experiment.model";
import type { FlowMaterialization } from "../models/flow.model";
import { ExperimentRepository } from "./experiment.repository";
import { FlowRepository } from "./flow.repository";

/**
 * Marker class for the two public errors constructed by this binder itself.
 * Repository/driver errors are never trusted merely because they reuse a safe
 * code: that would let an internal error spoof the binder perimeter and leak
 * its message/details.
 */
class BinderOwnedError extends AppError {
  constructor(error: AppError) {
    super(error.message, error.code, error.statusCode);
  }
}

export interface BindParams {
  experimentId: string;
  /**
   * The workbook id the use case observed. The bind locks the experiment row
   * and fails closed with a conflict if the row's workbook id no longer matches
   * (a concurrent attach/detach/set/upgrade slipped in between read and write).
   */
  expectedWorkbookId: string | null;
  /** Experiment pointer fields to set in the same transaction. */
  pointer: { workbookId?: string | null; workbookVersionId?: string };
  /** `flow` upserts the graph; `none` deletes any existing flow row. */
  materialization: FlowMaterialization;
}

export interface BindResult {
  /** The upserted flow row id, or null when the materialization was `none`. */
  flowId: string | null;
  /** The experiment row after the pointer update. */
  experiment: ExperimentDto;
}

/**
 * Focused unit-of-work that binds (or unbinds) an experiment's workbook pointer
 * AND its materialized flow row in ONE real transaction. It:
 *
 *  - locks the experiment row (`SELECT ... FOR UPDATE`) and rejects a stale
 *    write when the observed workbook id changed concurrently;
 *  - updates the pointer, then either upserts the flow graph or deletes the
 *    flow row (empty workbook = no flow);
 *  - rolls everything back if any step fails.
 *
 * Only two binder-owned errors are surfaced verbatim (not-found, conflict);
 * every repository/driver/internal failure is mapped to the fixed, sanitized
 * FLOW_BIND_FAILED and logged with fixed metadata only.
 */
@Injectable()
export class FlowBindingRepository {
  private readonly logger = new Logger(FlowBindingRepository.name);

  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
    private readonly experimentRepository: ExperimentRepository,
    private readonly flowRepository: FlowRepository,
  ) {}

  async bind(params: BindParams): Promise<Result<BindResult>> {
    const { experimentId, expectedWorkbookId, pointer, materialization } = params;
    try {
      let flowId: string | null = null;
      let experiment: ExperimentDto | undefined;

      await this.database.transaction(async (tx) => {
        // Lock the row and verify the observed workbook id still holds.
        const locked = await tx
          .select({ workbookId: experiments.workbookId })
          .from(experiments)
          .where(eq(experiments.id, experimentId))
          .for("update");
        if (locked.length === 0) {
          throw new BinderOwnedError(
            AppError.notFound(
              `Experiment with ID ${experimentId} not found`,
              ErrorCodes.FLOW_BIND_EXPERIMENT_NOT_FOUND,
            ),
          );
        }
        if ((locked[0].workbookId ?? null) !== (expectedWorkbookId ?? null)) {
          throw new BinderOwnedError(
            AppError.conflict(
              "The experiment workbook changed concurrently; please retry",
              ErrorCodes.FLOW_BIND_WORKBOOK_CONFLICT,
            ),
          );
        }

        const pointerResult = await this.experimentRepository.update(experimentId, pointer, tx);
        if (pointerResult.isFailure()) throw pointerResult.error;
        if (pointerResult.value.length === 0) {
          throw new BinderOwnedError(
            AppError.notFound(
              `Experiment with ID ${experimentId} not found`,
              ErrorCodes.FLOW_BIND_EXPERIMENT_NOT_FOUND,
            ),
          );
        }
        experiment = pointerResult.value[0];

        if (materialization.kind === "flow") {
          const flowResult = await this.flowRepository.upsert(
            experimentId,
            materialization.graph,
            tx,
          );
          if (flowResult.isFailure()) throw flowResult.error;
          flowId = flowResult.value.id;
        } else {
          const deleteResult = await this.flowRepository.deleteByExperimentId(experimentId, tx);
          if (deleteResult.isFailure()) throw deleteResult.error;
          flowId = null;
        }
      });

      // `experiment` is always assigned when the transaction commits; guard
      // defensively rather than asserting non-null.
      if (!experiment) {
        return failure(
          AppError.internal(
            "Bind committed without an experiment row",
            ErrorCodes.FLOW_BIND_FAILED,
          ),
        );
      }
      return success({ flowId, experiment });
    } catch (err) {
      return failure(this.sanitize(experimentId, err));
    }
  }

  // Preserve only the binder's own safe not-found/conflict codes; everything
  // else (repository, driver, unknown) collapses to a fixed sanitized code and
  // fixed, non-payload log metadata.
  private sanitize(experimentId: string, err: unknown): AppError {
    if (err instanceof BinderOwnedError) {
      return err;
    }
    // Fixed metadata only. Never serialize the thrown value: Error/AppError
    // messages and details may contain cells, graphs, commands, or driver data.
    this.logger.error({
      msg: "Flow bind transaction failed",
      errorCode: ErrorCodes.FLOW_BIND_FAILED,
      operation: "bindFlow",
      experimentId,
    });
    return AppError.internal(
      "Failed to bind the workbook version and flow",
      ErrorCodes.FLOW_BIND_FAILED,
    );
  }
}
