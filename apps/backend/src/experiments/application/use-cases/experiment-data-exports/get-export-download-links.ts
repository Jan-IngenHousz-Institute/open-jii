import { Inject, Injectable, Logger } from "@nestjs/common";

import type { ExperimentExportDownloadLinksResponse } from "@repo/api/domains/experiment/exports/experiment-exports.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, AppError, failure, success } from "../../../../common/utils/fp-utils";
import { buildExportFilename } from "../../../core/export-filename";
import { exportObjectKey } from "../../../core/models/experiment-data-exports.model";
import type { ExperimentExportDto } from "../../../core/models/experiment-data-exports.model";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { ExperimentDataExportsRepository } from "../../../core/repositories/experiment-data-exports.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

/**
 * Signs one short-lived link per part of a completed export, so the browser downloads the
 * files straight from storage. Links are signed per request; they outlive no page visit.
 */
@Injectable()
export class GetExportDownloadLinksUseCase {
  private readonly logger = new Logger(GetExportDownloadLinksUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly exportsRepository: ExperimentDataExportsRepository,
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
  ) {}

  async execute(
    experimentId: string,
    exportId: string,
  ): Promise<Result<ExperimentExportDownloadLinksResponse>> {
    // The experiment name is what makes the download recognisable on disk
    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(experimentResult.error);
    }

    const experiment = experimentResult.value;
    if (!experiment) {
      this.logger.warn({
        msg: "Attempt to download an export of a non-existent experiment",
        errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
        operation: "getExportDownloadLinks",
        experimentId,
        exportId,
      });
      return failure(AppError.notFound("Experiment not found"));
    }

    const exportResult = await this.exportsRepository.findById(experimentId, exportId);
    if (exportResult.isFailure()) {
      return failure(exportResult.error);
    }

    const record = exportResult.value;
    if (!record) {
      return failure(AppError.notFound("Export not found"));
    }
    if (record.status === "expired") {
      return failure(AppError.notFound("This export has expired", "EXPORT_EXPIRED"));
    }
    if (record.status !== "completed" || !record.parts) {
      return failure(
        AppError.badRequest("This export is not ready to download", "EXPORT_NOT_READY"),
      );
    }

    return this.signParts(experiment.name, record, record.parts);
  }

  private async signParts(
    experimentName: string,
    record: ExperimentExportDto,
    parts: NonNullable<ExperimentExportDto["parts"]>,
  ): Promise<Result<ExperimentExportDownloadLinksResponse>> {
    const signed = await Promise.all(
      parts.map(async (part, index) => {
        const fileName = buildExportFilename({
          experimentName,
          experimentId: record.experimentId,
          tableName: record.tableName,
          exportId: record.id,
          filePath: part.name,
          completedAt: record.completedAt?.toISOString() ?? null,
          part: { index, count: parts.length },
        });
        const url = await this.awsPort.getExportDownloadUrl(
          exportObjectKey(record, part.name),
          fileName,
        );

        return { index, fileName, sizeBytes: part.sizeBytes, url };
      }),
    );

    const links: ExperimentExportDownloadLinksResponse["parts"] = [];
    let expiresAt = Infinity;

    for (const { url, ...link } of signed) {
      if (url.isFailure()) {
        return failure(url.error);
      }

      links.push({ ...link, url: url.value.url });
      expiresAt = Math.min(expiresAt, url.value.expiresAt.getTime());
    }

    return success({ parts: links, expiresAt: new Date(expiresAt).toISOString() });
  }
}
