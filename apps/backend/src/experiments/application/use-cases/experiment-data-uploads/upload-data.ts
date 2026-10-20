import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { IncomingHttpHeaders } from "http";

import {
  UPLOAD_FILENAME_SCHEMAS,
  UPLOAD_KIND_CONSTANTS,
  zExperimentUploadFormFields,
  zExperimentUploadSourceKind,
} from "@repo/api/domains/experiment/experiment.schema";
import type {
  ExperimentUploadSourceKind,
  ExperimentUploadTargetTable,
} from "@repo/api/domains/experiment/experiment.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { compactTimestamp } from "../../../../common/utils/datetime";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import type { UploadErrorCode } from "../../../core/models/experiment-data-uploads.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { ExperimentDataUploadsRepository } from "../../../core/repositories/experiment-data-uploads.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { MultipartUploadService } from "../../services/multipart-upload.service";

export interface UploadedFileResult {
  fileName: string;
  filePath: string;
}

export interface UploadDataResult {
  uploadId: string;
  sourceKind: ExperimentUploadSourceKind;
  uploadTableId?: string;
  uploadTableName?: string;
  files: UploadedFileResult[];
}

export interface UploadExecuteInput {
  experimentId: string;
  userId: string;
  // When set, skips the form-level sourceKind read (controller pins it).
  fixedSourceKind?: ExperimentUploadSourceKind;
  requestStream: NodeJS.ReadableStream;
  requestHeaders: IncomingHttpHeaders;
}

interface ResolvedUploadTarget {
  uploadTableId: string;
  uploadTableName: string;
}

interface UploadContext {
  experiment: ExperimentDto;
  uploadId: string;
  directoryName: string;
  target: ResolvedUploadTarget;
  createdAt: Date;
}

/**
 * Records an upload as its files start arriving, streams them into the experiment's volume and
 * starts the upload job without waiting for it. The run's progress reaches the record through
 * the upload run reconciler, which also starts any run this could not.
 */
@Injectable()
export class UploadDataUseCase {
  private readonly logger = new Logger(UploadDataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly uploadsRepository: ExperimentDataUploadsRepository,
    private readonly multipartUploadService: MultipartUploadService,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(input: UploadExecuteInput): Promise<Result<UploadDataResult>> {
    this.logger.log({
      msg: "Starting upload",
      operation: "uploadData",
      experimentId: input.experimentId,
      fixedSourceKind: input.fixedSourceKind,
    });

    // Fields arrive before files; accumulate, resolve sourceKind + preexecute
    // on the first file event.
    const formFields: Record<string, string | undefined> = {};
    const successfulUploads: UploadedFileResult[] = [];
    const errors: { fileName: string; error: string }[] = [];
    const state: { ctx: UploadContext | null; sourceKind: ExperimentUploadSourceKind | null } = {
      ctx: null,
      sourceKind: null,
    };

    // Busboy needs the limit upfront, before we know the kind. Use the max
    // ceiling across all configured kinds; the per-kind limit is informational
    // for the FE picker and not a security boundary (Databricks itself caps
    // at 5 GiB and the contract zod schema constrains identifiers).
    const maxFileSize = Math.max(...Object.values(UPLOAD_KIND_CONSTANTS).map((k) => k.maxFileSize));
    const maxFileCount = Math.max(
      ...Object.values(UPLOAD_KIND_CONSTANTS).map((k) => k.maxFileCount),
    );

    const parseResult = await this.multipartUploadService.parse({
      requestStream: input.requestStream,
      requestHeaders: input.requestHeaders,
      limits: { maxFileSize, maxFileCount },
      onField: (name, value) => {
        formFields[name] = value;
      },
      onFile: async (file) => {
        if (!state.sourceKind) {
          const raw = input.fixedSourceKind ?? formFields.sourceKind;
          const parsed = raw ? zExperimentUploadSourceKind.safeParse(raw) : null;
          if (!parsed?.success) {
            file.stream.resume();
            const message = raw
              ? `Unsupported source kind: ${raw}`
              : "Missing 'sourceKind' form field";
            return failure(AppError.badRequest(message));
          }
          state.sourceKind = parsed.data;
        }
        if (!state.ctx) {
          const prep = await this.preexecute(
            input.experimentId,
            input.userId,
            state.sourceKind,
            formFields,
          );
          if (prep.isFailure()) {
            file.stream.resume();
            return failure(prep.error);
          }
          state.ctx = prep.value;
        }
        const filenameSchema = UPLOAD_FILENAME_SCHEMAS[state.sourceKind];
        const constants = UPLOAD_KIND_CONSTANTS[state.sourceKind];
        const parsed = filenameSchema.safeParse(file.filename);
        if (!parsed.success) {
          errors.push({
            fileName: file.filename,
            error: parsed.error.issues[0]?.message ?? "Invalid file name",
          });
          file.stream.resume();
          return success(undefined);
        }
        const safeName: string = parsed.data;
        const uploadResult = await this.databricksPort.uploadExperimentData(
          this.databricksPort.CENTRUM_SCHEMA_NAME,
          state.ctx.experiment.id,
          constants.volumeSourceType,
          state.ctx.directoryName,
          safeName,
          file.stream,
        );
        if (uploadResult.isFailure()) {
          // Whatever Databricks did not take is still arriving. Detach it from the failed request
          // and read it off, or busboy waits on this file and the whole request hangs.
          file.stream.unpipe();
          file.stream.resume();
          errors.push({ fileName: safeName, error: uploadResult.error.message });
          return success(undefined);
        }
        successfulUploads.push({ fileName: safeName, filePath: uploadResult.value.filePath });
        await this.recordFileReceived(state.ctx);
        return success(undefined);
      },
    });
    if (parseResult.isFailure()) {
      // Failed now rather than by the reconciler's sweep, so a new table's name is free for
      // the retry straight away.
      if (state.ctx) {
        await this.finishAsFailed(state.ctx, "transfer_interrupted");
      }
      return failure(parseResult.error);
    }
    if (!state.ctx || !state.sourceKind) {
      return failure(AppError.badRequest("Upload received no files"));
    }
    return this.postexecute(state.ctx, state.sourceKind, input.userId, successfulUploads, errors);
  }

  private async preexecute(
    experimentId: string,
    userId: string,
    sourceKind: ExperimentUploadSourceKind,
    formFields: {
      targetKind?: string;
      targetName?: string;
      uploadTableId?: string;
      uploadId?: string;
    },
  ): Promise<Result<UploadContext>> {
    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(AppError.internal("Failed to verify experiment access"));
    }
    const experiment = experimentResult.value;
    if (!experiment) {
      return failure(AppError.notFound("Experiment not found"));
    }
    // Archived experiments are read-only, even for admins.
    if (experiment.status === "archived") {
      return failure(AppError.forbidden("Cannot upload data to an archived experiment"));
    }

    const parsedForm = zExperimentUploadFormFields.safeParse({ ...formFields, sourceKind });
    if (!parsedForm.success) {
      return failure(
        AppError.badRequest(parsedForm.error.issues[0]?.message ?? "Invalid upload form fields"),
      );
    }
    if (parsedForm.data.targetKind === "new") {
      const access = await this.authz.can(userId, {
        resourceType: "experiment",
        resourceId: experimentId,
        action: "manage",
      });
      if (!access.allow) {
        return failure(
          AppError.forbidden("Creating a new data table requires experiment management access"),
        );
      }
    }
    const targetSelection: ExperimentUploadTargetTable =
      parsedForm.data.targetKind === "new"
        ? { kind: "new", name: parsedForm.data.targetName }
        : { kind: "existing", uploadTableId: parsedForm.data.uploadTableId };
    const validated = await this.uploadsRepository.validateTargetTable({
      experimentId,
      target: targetSelection,
    });
    if (validated.isFailure()) {
      return failure(validated.error);
    }
    const target = validated.value;

    const uploadId = parsedForm.data.uploadId ?? randomUUID();
    const directoryName = `upload_${compactTimestamp()}_${uploadId.slice(0, 8)}`;

    const recorded = await this.uploadsRepository.create({
      id: uploadId,
      experimentId,
      uploadTableId: target.uploadTableId,
      uploadTableName: target.uploadTableName,
      targetKind: parsedForm.data.targetKind,
      uploadDirectory: directoryName,
      sourceKind,
      createdBy: userId,
    });
    if (recorded.isFailure()) {
      return failure(recorded.error);
    }

    return success({
      experiment,
      uploadId,
      directoryName,
      target,
      createdAt: recorded.value.createdAt,
    });
  }

  private async postexecute(
    ctx: UploadContext,
    sourceKind: ExperimentUploadSourceKind,
    userId: string,
    successfulUploads: UploadedFileResult[],
    errors: { fileName: string; error: string }[],
  ): Promise<Result<UploadDataResult>> {
    if (successfulUploads.length === 0) {
      const errorDetails = errors.map((e) => `${e.fileName}: ${e.error}`).join(", ");
      this.logger.warn({
        msg: "Upload completed with no successful files",
        operation: "uploadData",
        experimentId: ctx.experiment.id,
        sourceKind,
        errorDetails,
      });
      await this.finishAsFailed(ctx, "no_files");
      return failure(AppError.badRequest(`Failed to upload data files. ${errorDetails}`));
    }

    const queued = await this.uploadsRepository.markQueued(ctx.uploadId, successfulUploads.length);
    if (queued.isFailure()) {
      return failure(queued.error);
    }
    if (queued.value === null) {
      return failure(
        AppError.conflict(
          "This upload stopped before its files finished arriving; start it again",
          "UPLOAD_TRANSFER_INTERRUPTED",
        ),
      );
    }

    const result = {
      uploadId: ctx.uploadId,
      sourceKind,
      uploadTableId: ctx.target.uploadTableId,
      uploadTableName: ctx.target.uploadTableName,
      files: successfulUploads,
    } satisfies UploadDataResult;

    const triggered = await this.databricksPort.triggerDataUploadJob({
      sourceKind,
      experimentId: ctx.experiment.id,
      experimentName: ctx.experiment.name,
      uploadDirectory: ctx.directoryName,
      uploadId: ctx.uploadId,
      uploadTableId: ctx.target.uploadTableId,
      uploadTableName: ctx.target.uploadTableName,
      userId,
      createdAt: ctx.createdAt,
    });

    // A trigger that failed or timed out is retried by the upload run reconciler, which
    // finds the run Databricks may already have accepted under the same upload id.
    if (triggered.isFailure()) {
      this.logger.warn({
        msg: "Could not start the upload job; the reconciler will try again",
        errorCode: ErrorCodes.DATABRICKS_JOB_FAILED,
        operation: "uploadData",
        experimentId: ctx.experiment.id,
        uploadId: ctx.uploadId,
        error: triggered.error.message,
      });
      return success(result);
    }

    const attached = await this.uploadsRepository.attachRun(ctx.uploadId, triggered.value.run_id);
    if (attached.isFailure()) {
      this.logger.warn({
        msg: "Could not record the upload's run; the reconciler will find it",
        operation: "uploadData",
        experimentId: ctx.experiment.id,
        uploadId: ctx.uploadId,
        error: attached.error.message,
      });
      return success(result);
    }

    this.logger.log({
      msg: "Upload completed",
      operation: "uploadData",
      experimentId: ctx.experiment.id,
      sourceKind,
      uploadId: ctx.uploadId,
      runId: triggered.value.run_id,
      fileCount: successfulUploads.length,
    });

    return success(result);
  }

  /** Keeps a long transfer that is still making progress clear of the reconciler's sweep. */
  private async recordFileReceived(ctx: UploadContext): Promise<void> {
    const recorded = await this.uploadsRepository.markFileReceived(ctx.uploadId);
    if (recorded.isFailure()) {
      this.logger.warn({
        msg: "Could not record a received file",
        operation: "uploadData",
        experimentId: ctx.experiment.id,
        uploadId: ctx.uploadId,
        error: recorded.error.message,
      });
    }
  }

  /** The request's own error response tells the uploader, so no notification follows. */
  private async finishAsFailed(ctx: UploadContext, errorCode: UploadErrorCode): Promise<void> {
    const failed = await this.uploadsRepository.failAnnounced(ctx.uploadId, errorCode);
    if (failed.isFailure()) {
      this.logger.error({
        msg: "Could not record a failed upload",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "uploadData",
        experimentId: ctx.experiment.id,
        uploadId: ctx.uploadId,
        error: failed.error.message,
      });
    }
  }
}
