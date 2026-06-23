import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { IncomingHttpHeaders } from "http";

import {
  UPLOAD_FILENAME_SCHEMAS,
  UPLOAD_KIND_CONSTANTS,
  zExperimentUploadSourceKind,
  zExperimentUploadTargetTable,
} from "@repo/api/domains/experiment/experiment.schema";
import type { ExperimentUploadSourceKind } from "@repo/api/domains/experiment/experiment.schema";

import { compactTimestamp } from "../../../../common/utils/datetime";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
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
  runId?: number;
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
}

@Injectable()
export class UploadDataUseCase {
  private readonly logger = new Logger(UploadDataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly uploadsRepository: ExperimentDataUploadsRepository,
    private readonly multipartUploadService: MultipartUploadService,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
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
          errors.push({ fileName: safeName, error: uploadResult.error.message });
          return success(undefined);
        }
        successfulUploads.push({ fileName: safeName, filePath: uploadResult.value.filePath });
        return success(undefined);
      },
    });
    if (parseResult.isFailure()) {
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
    _sourceKind: ExperimentUploadSourceKind,
    formFields: { targetKind?: string; targetName?: string; uploadTableId?: string },
  ): Promise<Result<UploadContext>> {
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);
    if (accessResult.isFailure()) {
      return failure(AppError.internal("Failed to verify experiment access"));
    }
    const { experiment, hasArchiveAccess } = accessResult.value;
    if (!experiment) {
      return failure(AppError.notFound("Experiment not found"));
    }
    if (!hasArchiveAccess) {
      return failure(AppError.forbidden("Access denied to this experiment"));
    }

    const parsed =
      formFields.targetKind === "existing"
        ? zExperimentUploadTargetTable.safeParse({
            kind: "existing",
            uploadTableId: formFields.uploadTableId,
          })
        : zExperimentUploadTargetTable.safeParse({
            kind: "new",
            name: formFields.targetName,
          });
    if (!parsed.success) {
      return failure(
        AppError.badRequest(parsed.error.issues[0]?.message ?? "Invalid target table"),
      );
    }
    const validated = await this.uploadsRepository.validateTargetTable({
      experimentId,
      target: parsed.data,
    });
    if (validated.isFailure()) {
      return failure(validated.error);
    }
    const target = validated.value;

    const uploadId = randomUUID();
    const directoryName = `upload_${compactTimestamp()}_${uploadId.slice(0, 8)}`;
    return success({ experiment, uploadId, directoryName, target });
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
      return failure(AppError.badRequest(`Failed to upload data files. ${errorDetails}`));
    }

    const jobResult = await this.databricksPort.triggerDataUploadJob({
      sourceKind,
      experimentId: ctx.experiment.id,
      experimentName: ctx.experiment.name,
      uploadDirectory: ctx.directoryName,
      uploadId: ctx.uploadId,
      uploadTableId: ctx.target.uploadTableId,
      uploadTableName: ctx.target.uploadTableName,
      userId,
    });
    if (jobResult.isFailure()) {
      return failure(jobResult.error);
    }

    this.logger.log({
      msg: "Upload completed",
      operation: "uploadData",
      experimentId: ctx.experiment.id,
      sourceKind,
      uploadId: ctx.uploadId,
      runId: jobResult.value.run_id,
      fileCount: successfulUploads.length,
    });

    return success({
      uploadId: ctx.uploadId,
      sourceKind,
      uploadTableId: ctx.target.uploadTableId,
      uploadTableName: ctx.target.uploadTableName,
      runId: jobResult.value.run_id,
      files: successfulUploads,
    });
  }
}
