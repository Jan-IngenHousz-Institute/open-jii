import { Injectable, Logger } from "@nestjs/common";
import { Effect } from "effect";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

import type { Result } from "~/common/types/fp-types";
import { Failure, Success } from "~/common/types/fp-types";

export interface UploadDataRequest {
  experimentId: string;
  userId: string;
  sensorFamily: "MultispeQ" | "Ambyte";
  file: Buffer;
  filename: string;
  mimetype: string;
}

export interface UploadDataResult {
  success: boolean;
  message: string;
  jobId?: string;
}

@Injectable()
export class UploadDataUseCase {
  private readonly logger = new Logger(UploadDataUseCase.name);

  async execute(request: UploadDataRequest): Promise<Result<UploadDataResult>> {
    return Effect.runPromise(
      Effect.gen(this, function* () {
        const { experimentId, userId, sensorFamily, file, filename, mimetype } = request;

        this.logger.log(
          `Starting data upload for experiment ${experimentId}, sensor family: ${sensorFamily}`,
        );

        // Validate file type
        if (sensorFamily === "Ambyte" && !filename.endsWith(".zip")) {
          yield* Effect.fail(
            Failure.badRequest("Invalid file type. Ambyte data must be uploaded as a .zip file."),
          );
        }

        if (mimetype !== "application/zip" && sensorFamily === "Ambyte") {
          yield* Effect.fail(
            Failure.badRequest("Invalid MIME type. Expected application/zip for Ambyte data."),
          );
        }

        // Validate file size (100MB limit)
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.length > maxSize) {
          yield* Effect.fail(
            Failure.badRequest("File size exceeds maximum limit of 100MB."),
          );
        }

        // Create upload directory if it doesn't exist
        const uploadDir = join(process.cwd(), "uploads", experimentId);
        if (!existsSync(uploadDir)) {
          mkdirSync(uploadDir, { recursive: true });
        }

        // Generate unique filename
        const jobId = uuidv4();
        const timestamp = new Date().toISOString().replace(/:/g, "-");
        const fileExtension = filename.split(".").pop();
        const uniqueFilename = `${sensorFamily}_${timestamp}_${jobId}.${fileExtension}`;
        const filePath = join(uploadDir, uniqueFilename);

        try {
          // Save file to disk
          writeFileSync(filePath, file);
          this.logger.log(`File saved to ${filePath}`);

          // Here you would typically:
          // 1. Validate the file structure (for Ambyte, check the expected folder structure)
          // 2. Queue the file for processing with Databricks
          // 3. Store metadata in the database

          // For now, we'll just return success
          const result: UploadDataResult = {
            success: true,
            message: `${sensorFamily} data uploaded successfully and queued for processing.`,
            jobId,
          };

          this.logger.log(
            `Data upload completed successfully for experiment ${experimentId}, job ID: ${jobId}`,
          );

          return Success.of(result);
        } catch (error) {
          this.logger.error(`Failed to save file: ${error}`);
          yield* Effect.fail(
            Failure.internalServerError("Failed to save uploaded file."),
          );
        }
      }),
    );
  }

  // Helper method to validate Ambyte file structure
  private async validateAmbyteStructure(filePath: string): Promise<boolean> {
    // This is a placeholder for file structure validation
    // In a real implementation, you would:
    // 1. Unzip the file temporarily
    // 2. Check for expected directories (numbered folders, config.txt, etc.)
    // 3. Validate file naming patterns
    // 4. Check for required files like ambyte_log.txt, config.txt, run.txt
    
    this.logger.log(`Validating Ambyte structure for file: ${filePath}`);
    
    // For now, just return true
    // TODO: Implement actual validation logic
    return true;
  }
}