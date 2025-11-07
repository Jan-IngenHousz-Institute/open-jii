import { faker } from "@faker-js/faker";
import { Readable } from "stream";

import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import { UploadAmbyteDataUseCase } from "./upload-ambyte-data";

/* eslint-disable @typescript-eslint/unbound-method */

describe("UploadAmbyteDataUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: UploadAmbyteDataUseCase;
  let databricksPort: DatabricksPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(UploadAmbyteDataUseCase);
    databricksPort = testApp.module.get(DATABRICKS_PORT);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("preexecute", () => {
    const experimentId = faker.string.uuid();
    const experimentName = "Test Experiment";

    it("should return success when volume already exists", async () => {
      // Mock volume exists
      const mockVolumeResponse = {
        name: "data-uploads",
        volume_id: faker.string.uuid(),
        catalog_name: "main",
        schema_name: `exp_test_experiment_${experimentId}`,
        volume_type: "MANAGED" as const,
        full_name: `main.exp_test_experiment_${experimentId}.data-uploads`,
        created_at: Date.now(),
        created_by: faker.string.uuid(),
        updated_at: Date.now(),
        updated_by: faker.string.uuid(),
        metastore_id: faker.string.uuid(),
        owner: faker.string.uuid(),
      };

      vi.spyOn(databricksPort, "getExperimentVolume").mockResolvedValue(
        success(mockVolumeResponse),
      );

      const result = await useCase.preexecute(experimentId, experimentName);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(result.value).toMatchObject({
        volumeName: "data-uploads",
        volumeExists: true,
        volumeCreated: false,
      });

      // Verify directoryName has the correct format: upload_YYYYMMDD_HHMMSS
      expect(result.value.directoryName).toMatch(/^upload_\d{8}_\d{6}$/);

      expect(databricksPort.getExperimentVolume).toHaveBeenCalledWith(
        experimentName,
        experimentId,
        "data-uploads",
      );
    });

    it("should create volume when it doesn't exist", async () => {
      // Mock volume doesn't exist
      vi.spyOn(databricksPort, "getExperimentVolume").mockResolvedValue(
        failure(AppError.notFound("Volume not found")),
      );

      // Mock successful volume creation
      const mockVolumeResponse = {
        name: "data-uploads",
        volume_id: faker.string.uuid(),
        catalog_name: "main",
        schema_name: `exp_test_experiment_${experimentId}`,
        volume_type: "MANAGED" as const,
        full_name: `main.exp_test_experiment_${experimentId}.data-uploads`,
        created_at: Date.now(),
        created_by: faker.string.uuid(),
        updated_at: Date.now(),
        updated_by: faker.string.uuid(),
        metastore_id: faker.string.uuid(),
        owner: faker.string.uuid(),
      };

      vi.spyOn(databricksPort, "createExperimentVolume").mockResolvedValue(
        success(mockVolumeResponse),
      );

      const result = await useCase.preexecute(experimentId, experimentName);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(result.value).toMatchObject({
        volumeName: "data-uploads",
        volumeExists: false,
        volumeCreated: true,
      });

      expect(databricksPort.createExperimentVolume).toHaveBeenCalledWith(
        experimentName,
        experimentId,
        "data-uploads",
        `Ambyte data uploads volume for experiment ${experimentName}`,
      );
    });

    it("should return failure when volume creation fails", async () => {
      // Mock volume doesn't exist
      vi.spyOn(databricksPort, "getExperimentVolume").mockResolvedValue(
        failure(AppError.notFound("Volume not found")),
      );

      // Mock failed volume creation
      const createError = AppError.internal("Failed to create volume");
      vi.spyOn(databricksPort, "createExperimentVolume").mockResolvedValue(failure(createError));

      const result = await useCase.preexecute(experimentId, experimentName);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error).toBe(createError);
    });
  });

  describe("execute", () => {
    const experimentId = faker.string.uuid();
    const experimentName = "Test Experiment";
    const sourceType = "ambyte";
    const directoryName = "upload_20250910_143000";
    let successfulUploads: { fileName: string; filePath: string }[];
    let errors: { fileName: string; error: string }[];

    beforeEach(() => {
      successfulUploads = [];
      errors = [];
    });

    const createMockFile = (filename: string, content = "test file content") => {
      const stream = new Readable({
        read() {
          this.push(content);
          this.push(null); // End the stream
        },
      });

      return {
        filename,
        encoding: "utf8",
        mimetype: "text/plain",
        stream,
      };
    };

    it("should successfully upload a valid Ambyte file", async () => {
      const fileName = "Ambyte_1/data.txt";
      const file = createMockFile(fileName);

      const mockUploadResponse = {
        filePath: `/Volumes/main/exp_test_experiment_${experimentId}/data-uploads/${sourceType}/${directoryName}/${fileName}`,
      };

      vi.spyOn(databricksPort, "uploadExperimentData").mockResolvedValue(
        success(mockUploadResponse),
      );

      await useCase.execute(
        file,
        experimentId,
        experimentName,
        sourceType,
        directoryName,
        successfulUploads,
        errors,
      );

      expect(successfulUploads).toHaveLength(1);
      expect(successfulUploads[0]).toEqual({
        fileName,
        filePath: mockUploadResponse.filePath,
      });
      expect(errors).toHaveLength(0);

      expect(databricksPort.uploadExperimentData).toHaveBeenCalledWith(
        experimentId,
        experimentName,
        sourceType,
        directoryName,
        fileName,
        expect.any(Buffer),
      );
    });

    it("should successfully upload a valid Ambyte file with subdirectory", async () => {
      const fileName = "Ambyte_2/1/data.txt";
      const file = createMockFile(fileName);

      const mockUploadResponse = {
        filePath: `/Volumes/main/exp_test_experiment_${experimentId}/data-uploads/${sourceType}/${directoryName}/${fileName}`,
      };

      vi.spyOn(databricksPort, "uploadExperimentData").mockResolvedValue(
        success(mockUploadResponse),
      );

      await useCase.execute(
        file,
        experimentId,
        experimentName,
        sourceType,
        directoryName,
        successfulUploads,
        errors,
      );

      expect(successfulUploads).toHaveLength(1);
      expect(successfulUploads[0]).toEqual({
        fileName,
        filePath: mockUploadResponse.filePath,
      });
      expect(errors).toHaveLength(0);
    });

    it("should trim parent directories and upload valid Ambyte file", async () => {
      const originalFileName = "some/parent/dir/Ambyte_3/data.txt";
      const expectedTrimmedName = "Ambyte_3/data.txt";
      const file = createMockFile(originalFileName);

      const mockUploadResponse = {
        filePath: `/Volumes/main/exp_test_experiment_${experimentId}/data-uploads/${sourceType}/${directoryName}/${expectedTrimmedName}`,
      };

      vi.spyOn(databricksPort, "uploadExperimentData").mockResolvedValue(
        success(mockUploadResponse),
      );

      await useCase.execute(
        file,
        experimentId,
        experimentName,
        sourceType,
        directoryName,
        successfulUploads,
        errors,
      );

      expect(successfulUploads).toHaveLength(1);
      expect(successfulUploads[0]).toEqual({
        fileName: expectedTrimmedName,
        filePath: mockUploadResponse.filePath,
      });
      expect(errors).toHaveLength(0);

      expect(databricksPort.uploadExperimentData).toHaveBeenCalledWith(
        experimentId,
        experimentName,
        sourceType,
        directoryName,
        expectedTrimmedName,
        expect.any(Buffer),
      );
    });

    it("should handle plain .txt files and construct appropriate paths", async () => {
      const testCases = [
        {
          fileName: "20250614-000059_.txt",
          expectedPath: "unknown_ambyte/unknown_ambit/20250614-000059_.txt",
        },
        {
          fileName: "20250612-132005_.txt",
          expectedPath: "unknown_ambyte/unknown_ambit/20250612-132005_.txt",
        },
        {
          fileName: "some_file.txt",
          expectedPath: "unknown_ambyte/some_file.txt",
        },
        {
          fileName: "data.txt",
          expectedPath: "unknown_ambyte/data.txt",
        },
      ];

      for (const testCase of testCases) {
        const file = createMockFile(testCase.fileName);

        const mockUploadResponse = {
          filePath: `/Volumes/main/exp_test_experiment_${experimentId}/data-uploads/${sourceType}/${directoryName}/${testCase.expectedPath}`,
        };

        vi.spyOn(databricksPort, "uploadExperimentData").mockResolvedValue(
          success(mockUploadResponse),
        );

        await useCase.execute(
          file,
          experimentId,
          experimentName,
          sourceType,
          directoryName,
          successfulUploads,
          errors,
        );

        expect(successfulUploads).toHaveLength(1);
        expect(successfulUploads[0]).toEqual({
          fileName: testCase.expectedPath,
          filePath: mockUploadResponse.filePath,
        });
        expect(errors).toHaveLength(0);

        expect(databricksPort.uploadExperimentData).toHaveBeenCalledWith(
          experimentId,
          experimentName,
          sourceType,
          directoryName,
          testCase.expectedPath,
          expect.any(Buffer),
        );

        // Reset for next iteration
        successfulUploads.length = 0;
        errors.length = 0;
        vi.clearAllMocks();
      }
    });

    it("should accept any .txt file even if it doesn't match Ambyte patterns", async () => {
      const plainTxtFiles = ["simple.txt", "data_file.txt", "measurements.txt", "results_2024.txt"];

      for (const fileName of plainTxtFiles) {
        const file = createMockFile(fileName);

        const mockUploadResponse = {
          filePath: `/Volumes/main/exp_test_experiment_${experimentId}/data-uploads/${sourceType}/${directoryName}/unknown_ambyte/${fileName}`,
        };

        vi.spyOn(databricksPort, "uploadExperimentData").mockResolvedValue(
          success(mockUploadResponse),
        );

        await useCase.execute(
          file,
          experimentId,
          experimentName,
          sourceType,
          directoryName,
          successfulUploads,
          errors,
        );

        expect(successfulUploads).toHaveLength(1);
        expect(successfulUploads[0]).toEqual({
          fileName: `unknown_ambyte/${fileName}`,
          filePath: mockUploadResponse.filePath,
        });
        expect(errors).toHaveLength(0);

        // Reset for next iteration
        successfulUploads.length = 0;
        errors.length = 0;
        vi.clearAllMocks();
      }
    });

    it("should reject invalid file names", async () => {
      const invalidFileNames = [
        "NotAmbyte_1/data.txt",
        "Ambyte_/data.txt",
        "Ambyte_1/5/data.txt", // Invalid subdirectory (only 1-4 allowed)
        "Ambyte_1/data.pdf", // Invalid extension
        "Ambyte_1000/data.txt", // Number too large
        "invalid.pdf", // Not a .txt file
        "data.doc", // Not a .txt file
      ];

      // Add spy to ensure it's not called
      const uploadSpy = vi.spyOn(databricksPort, "uploadExperimentData");

      for (const fileName of invalidFileNames) {
        const file = createMockFile(fileName);

        await useCase.execute(
          file,
          experimentId,
          experimentName,
          sourceType,
          directoryName,
          successfulUploads,
          errors,
        );
      }

      expect(successfulUploads).toHaveLength(0);
      expect(errors).toHaveLength(invalidFileNames.length);

      errors.forEach((error) => {
        expect(error.error).toContain("Invalid file format");
      });

      expect(uploadSpy).not.toHaveBeenCalled();
    });

    it("should handle missing sourceType", async () => {
      const fileName = "Ambyte_1/data.txt";
      const file = createMockFile(fileName);

      // Add spy to ensure it's not called
      const uploadSpy = vi.spyOn(databricksPort, "uploadExperimentData");

      await useCase.execute(
        file,
        experimentId,
        experimentName,
        undefined, // sourceType is undefined
        directoryName,
        successfulUploads,
        errors,
      );

      expect(successfulUploads).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        fileName,
        error: "Source type is required",
      });

      expect(uploadSpy).not.toHaveBeenCalled();
    });

    it("should handle upload failure", async () => {
      const fileName = "Ambyte_1/data.txt";
      const file = createMockFile(fileName);

      const uploadError = AppError.internal("Upload failed");
      vi.spyOn(databricksPort, "uploadExperimentData").mockResolvedValue(failure(uploadError));

      await useCase.execute(
        file,
        experimentId,
        experimentName,
        sourceType,
        directoryName,
        successfulUploads,
        errors,
      );

      expect(successfulUploads).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        fileName,
        error: uploadError.message,
      });
    });

    it("should handle large files within size limit", async () => {
      const fileName = "Ambyte_1/large_data.txt";
      const largeContent = "x".repeat(1024 * 1024); // 1MB content
      const file = createMockFile(fileName, largeContent);

      const mockUploadResponse = {
        filePath: `/Volumes/main/exp_test_experiment_${experimentId}/data-uploads/${sourceType}/${directoryName}/${fileName}`,
      };

      vi.spyOn(databricksPort, "uploadExperimentData").mockResolvedValue(
        success(mockUploadResponse),
      );

      await useCase.execute(
        file,
        experimentId,
        experimentName,
        sourceType,
        directoryName,
        successfulUploads,
        errors,
      );

      expect(successfulUploads).toHaveLength(1);
      expect(errors).toHaveLength(0);

      // Verify the buffer size matches expected content
      const uploadCall = vi.mocked(databricksPort.uploadExperimentData).mock.calls[0];
      const buffer = uploadCall[5];
      expect(buffer.length).toBe(largeContent.length);
    });
  });

  describe("postexecute", () => {
    const directoryName = "upload_20250910_143000";

    it("should return success with successful uploads and trigger ambyte processing job", async () => {
      const successfulUploads = [
        { fileName: "Ambyte_1/data1.txt", filePath: "/path/to/data1.txt" },
        { fileName: "Ambyte_2/data2.txt", filePath: "/path/to/data2.txt" },
      ];
      const errors: { fileName: string; error: string }[] = [];
      const experiment = {
        id: faker.string.uuid(),
        name: "Test Experiment",
        description: "Test experiment description",
        status: "active" as const,
        visibility: "private" as const,
        embargoUntil: new Date(),
        createdBy: faker.string.uuid(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockJobResponse = {
        run_id: faker.number.int(),
        number_in_job: 1,
      };

      vi.spyOn(databricksPort, "triggerAmbyteProcessingJob").mockResolvedValue(
        success(mockJobResponse),
      );

      const result = await useCase.postexecute(
        successfulUploads,
        errors,
        experiment,
        directoryName,
      );

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(result.value).toEqual({
        files: successfulUploads,
      });

      expect(databricksPort.triggerAmbyteProcessingJob).toHaveBeenCalledWith(
        experiment.id,
        experiment.name,
        {
          EXPERIMENT_ID: experiment.id,
          YEAR_PREFIX: "2025",
          UPLOAD_DIRECTORY: directoryName,
        },
      );
    });

    it("should return success even when ambyte processing job trigger fails", async () => {
      const successfulUploads = [
        { fileName: "Ambyte_1/data1.txt", filePath: "/path/to/data1.txt" },
      ];
      const errors: { fileName: string; error: string }[] = [];
      const experiment = {
        id: faker.string.uuid(),
        name: "Test Experiment",
        description: "Test experiment description",
        status: "active" as const,
        visibility: "private" as const,
        embargoUntil: new Date(),
        createdBy: faker.string.uuid(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(databricksPort, "triggerAmbyteProcessingJob").mockResolvedValue(
        failure(AppError.internal("Job trigger failed")),
      );

      const result = await useCase.postexecute(
        successfulUploads,
        errors,
        experiment,
        directoryName,
      );

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(result.value).toEqual({
        files: successfulUploads,
      });
    });

    it("should return failure when no files were uploaded successfully", async () => {
      const successfulUploads: { fileName: string; filePath: string }[] = [];
      const errors = [
        { fileName: "invalid.txt", error: "Invalid file format" },
        { fileName: "Ambyte_1/failed.txt", error: "Upload failed" },
      ];
      const experiment = {
        id: faker.string.uuid(),
        name: "Test Experiment",
        description: "Test experiment description",
        status: "active" as const,
        visibility: "private" as const,
        embargoUntil: new Date(),
        createdBy: faker.string.uuid(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add spy to ensure it's not called
      const pipelineSpy = vi.spyOn(databricksPort, "triggerAmbyteProcessingJob");

      const result = await useCase.postexecute(
        successfulUploads,
        errors,
        experiment,
        directoryName,
      );

      expect(result.isFailure()).toBe(true);
      assertFailure(result);

      expect(result.error.message).toContain("Failed to upload Ambyte data files");
      expect(result.error.message).toContain("invalid.txt: Invalid file format");
      expect(result.error.message).toContain("Ambyte_1/failed.txt: Upload failed");

      expect(pipelineSpy).not.toHaveBeenCalled();
    });

    it("should return success with mixed results (some successful, some failed)", async () => {
      const successfulUploads = [
        { fileName: "Ambyte_1/data1.txt", filePath: "/path/to/data1.txt" },
      ];
      const errors = [{ fileName: "invalid.txt", error: "Invalid file format" }];
      const experiment = {
        id: faker.string.uuid(),
        name: "Test Experiment",
        description: "Test experiment description",
        status: "active" as const,
        visibility: "private" as const,
        embargoUntil: new Date(),
        createdBy: faker.string.uuid(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockJobResponse = {
        run_id: faker.number.int(),
        number_in_job: 1,
      };

      vi.spyOn(databricksPort, "triggerAmbyteProcessingJob").mockResolvedValue(
        success(mockJobResponse),
      );

      const result = await useCase.postexecute(
        successfulUploads,
        errors,
        experiment,
        directoryName,
      );

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(result.value).toEqual({
        files: successfulUploads,
      });

      expect(databricksPort.triggerAmbyteProcessingJob).toHaveBeenCalledWith(
        experiment.id,
        experiment.name,
        {
          EXPERIMENT_ID: experiment.id,
          YEAR_PREFIX: "2025",
          UPLOAD_DIRECTORY: directoryName,
        },
      );
    });
  });

  describe("validateFileName", () => {
    const createMockFileForTest = (filename: string, content = "test file content") => {
      const stream = new Readable({
        read() {
          this.push(content);
          this.push(null); // End the stream
        },
      });

      return {
        filename,
        encoding: "utf8",
        mimetype: "text/plain",
        stream,
      };
    };

    it("should validate correct Ambyte file names with full paths", async () => {
      const validFileNames = [
        "Ambyte_1/data.txt",
        "Ambyte_2/1/data.txt",
        "Ambyte_10/2/measurement.txt",
        "Ambyte_123/3/results.txt",
        "parent/dir/Ambyte_5/4/file.txt",
        "deep/nested/path/Ambyte_99/output.txt",
      ];

      for (const fileName of validFileNames) {
        const file = createMockFileForTest(fileName);

        const successfulUploads: { fileName: string; filePath: string }[] = [];
        const errors: { fileName: string; error: string }[] = [];

        vi.spyOn(databricksPort, "uploadExperimentData").mockResolvedValue(
          success({ filePath: "/mock/path" }),
        );

        await useCase.execute(
          file,
          faker.string.uuid(),
          "Test Experiment",
          "ambyte",
          "upload_20250910_143000",
          successfulUploads,
          errors,
        );

        expect(errors).toHaveLength(0);
        expect(successfulUploads).toHaveLength(1);
      }
    });

    it("should validate plain .txt files", async () => {
      const validFileNames = [
        "simple.txt",
        "20250614-000059_.txt",
        "data_file.txt",
        "measurements.txt",
        "results_2024.txt",
      ];

      for (const fileName of validFileNames) {
        const file = createMockFileForTest(fileName);

        const successfulUploads: { fileName: string; filePath: string }[] = [];
        const errors: { fileName: string; error: string }[] = [];

        vi.spyOn(databricksPort, "uploadExperimentData").mockResolvedValue(
          success({ filePath: "/mock/path" }),
        );

        await useCase.execute(
          file,
          faker.string.uuid(),
          "Test Experiment",
          "ambyte",
          "upload_20250910_143000",
          successfulUploads,
          errors,
        );

        expect(errors).toHaveLength(0);
        expect(successfulUploads).toHaveLength(1);
      }
    });

    it("should reject invalid file formats", async () => {
      const invalidFileNames = [
        "NotAmbyte_1/data.txt", // Invalid path structure
        "Ambyte_/data.txt", // Missing number
        "Ambyte_1/5/data.txt", // Invalid subdirectory
        "Ambyte_1/data.pdf", // Invalid extension in path
        "Ambyte_1000/data.txt", // Number too large
        "Ambyte_1", // Missing file
        "Ambyte_1/", // Missing file
        "", // Empty string
        "Ambyte_abc/data.txt", // Non-numeric ID
        "simple.pdf", // Not a .txt file
        "data.doc", // Not a .txt file
        "file.xlsx", // Not a .txt file
      ];

      for (const fileName of invalidFileNames) {
        const file = createMockFileForTest(fileName);

        const successfulUploads: { fileName: string; filePath: string }[] = [];
        const errors: { fileName: string; error: string }[] = [];

        await useCase.execute(
          file,
          faker.string.uuid(),
          "Test Experiment",
          "ambyte",
          "upload_20250910_143000",
          successfulUploads,
          errors,
        );

        expect(errors).toHaveLength(1);
        expect(successfulUploads).toHaveLength(0);
        expect(errors[0].error).toContain("Invalid file format");
      }
    });
  });

  describe("trimFileName", () => {
    const createMockFileForTest = (filename: string, content = "test file content") => {
      const stream = new Readable({
        read() {
          this.push(content);
          this.push(null); // End the stream
        },
      });

      return {
        filename,
        encoding: "utf8",
        mimetype: "text/plain",
        stream,
      };
    };

    it("should trim parent directories correctly for files with Ambyte paths", async () => {
      const testCases = [
        {
          input: "some/parent/dir/Ambyte_1/data.txt",
          expected: "Ambyte_1/data.txt",
        },
        {
          input: "deep/nested/path/Ambyte_2/1/measurement.txt",
          expected: "Ambyte_2/1/measurement.txt",
        },
        {
          input: "Ambyte_3/file.txt", // Already trimmed
          expected: "Ambyte_3/file.txt",
        },
      ];

      for (const testCase of testCases) {
        const file = createMockFileForTest(testCase.input);

        const successfulUploads: { fileName: string; filePath: string }[] = [];
        const errors: { fileName: string; error: string }[] = [];

        vi.spyOn(databricksPort, "uploadExperimentData").mockResolvedValue(
          success({ filePath: "/mock/path" }),
        );

        await useCase.execute(
          file,
          faker.string.uuid(),
          "Test Experiment",
          "ambyte",
          "upload_20250910_143000",
          successfulUploads,
          errors,
        );

        expect(successfulUploads).toHaveLength(1);
        expect(successfulUploads[0].fileName).toBe(testCase.expected);

        // Verify the databricks call used the trimmed name
        expect(databricksPort.uploadExperimentData).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          testCase.expected,
          expect.any(Buffer),
        );
      }
    });

    it("should construct paths for plain .txt files", async () => {
      const testCases = [
        {
          input: "20250614-000059_.txt",
          expected: "unknown_ambyte/unknown_ambit/20250614-000059_.txt",
        },
        {
          input: "20250612-132005_.txt",
          expected: "unknown_ambyte/unknown_ambit/20250612-132005_.txt",
        },
        {
          input: "simple.txt",
          expected: "unknown_ambyte/simple.txt",
        },
        {
          input: "data_file.txt",
          expected: "unknown_ambyte/data_file.txt",
        },
        {
          input: "measurements.txt",
          expected: "unknown_ambyte/measurements.txt",
        },
      ];

      for (const testCase of testCases) {
        const file = createMockFileForTest(testCase.input);

        const successfulUploads: { fileName: string; filePath: string }[] = [];
        const errors: { fileName: string; error: string }[] = [];

        vi.spyOn(databricksPort, "uploadExperimentData").mockResolvedValue(
          success({ filePath: "/mock/path" }),
        );

        await useCase.execute(
          file,
          faker.string.uuid(),
          "Test Experiment",
          "ambyte",
          "upload_20250910_143000",
          successfulUploads,
          errors,
        );

        expect(successfulUploads).toHaveLength(1);
        expect(successfulUploads[0].fileName).toBe(testCase.expected);

        // Verify the databricks call used the constructed path
        expect(databricksPort.uploadExperimentData).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          testCase.expected,
          expect.any(Buffer),
        );
      }
    });
  });

  describe("constants", () => {
    it("should have correct static constants", () => {
      expect(UploadAmbyteDataUseCase.MAX_FILE_SIZE).toBe(10 * 1024 * 1024); // 10MB
      expect(UploadAmbyteDataUseCase.MAX_FILE_COUNT).toBe(1000);
      expect(UploadAmbyteDataUseCase.UPLOADS_VOLUME_NAME).toBe("data-uploads");
    });
  });
});
