/* eslint-disable @typescript-eslint/unbound-method */
import { faker } from "@faker-js/faker";
import type { IncomingHttpHeaders } from "http";
import { Readable } from "stream";

import { experimentUploads } from "@repo/database";

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
import { ExperimentDataUploadsRepository } from "../../../core/repositories/experiment-data-uploads.repository";
import { MultipartUploadService } from "../../services/multipart-upload.service";
import type { MultipartFile, ParseMultipartInput } from "../../services/multipart-upload.service";
import { UploadDataUseCase } from "./upload-data";

const MULTIPART_HEADERS: IncomingHttpHeaders = {
  "content-type": "multipart/form-data; boundary=----test",
};

function makeFile(filename: string, content = "h\n1"): MultipartFile {
  return {
    filename,
    encoding: "7bit",
    mimeType: "text/plain",
    stream: Readable.from([content]),
  };
}

// Drives the use case's multipart loop by capturing the onField/onFile callbacks
// and emitting events in the order multipart bodies normally arrive (fields, then files).
// Mirrors the real MultipartUploadService's first-failure short-circuit so the use case
// sees the same failure-propagation semantics it gets in production.
function mountMultipart(
  multipartService: MultipartUploadService,
  script: (callbacks: {
    field: (name: string, value: string) => void;
    file: (file: MultipartFile) => Promise<unknown>;
  }) => Promise<void>,
) {
  vi.spyOn(multipartService, "parse").mockImplementation(async (input: ParseMultipartInput) => {
    const results: Awaited<ReturnType<typeof input.onFile>>[] = [];
    const wrappedFile = async (file: MultipartFile) => {
      const result = await input.onFile(file);
      results.push(result);
      return result;
    };
    await script({ field: input.onField, file: wrappedFile });
    return results.find((r) => r.isFailure()) ?? success(undefined);
  });
}

describe("UploadDataUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UploadDataUseCase;
  let databricksPort: DatabricksPort;
  let uploadsRepository: ExperimentDataUploadsRepository;
  let multipartUploadService: MultipartUploadService;

  const storedUploads = () => testApp.database.select().from(experimentUploads);

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(UploadDataUseCase);
    databricksPort = testApp.module.get(DATABRICKS_PORT);
    uploadsRepository = testApp.module.get(ExperimentDataUploadsRepository);
    multipartUploadService = testApp.module.get(MultipartUploadService);

    vi.spyOn(databricksPort, "uploadExperimentData").mockResolvedValue(
      success({ filePath: "/Volumes/c/centrum/data-imports/.../file" }),
    );
    vi.spyOn(databricksPort, "triggerDataUploadJob").mockResolvedValue(
      success({ run_id: 12345, number_in_job: 1 }),
    );
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const STUB_UPLOAD_TABLE_ID = "22222222-2222-2222-2222-222222222222";

  it("uploads a CSV to a new target table and triggers the job", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Csv_New_Target",
      userId: testUserId,
    });
    vi.spyOn(uploadsRepository, "validateTargetTable").mockResolvedValue(
      success({ uploadTableId: STUB_UPLOAD_TABLE_ID, uploadTableName: "greenhouse_temps" }),
    );

    mountMultipart(multipartUploadService, async ({ field, file }) => {
      field("sourceKind", "csv");
      field("targetKind", "new");
      field("targetName", "greenhouse_temps");
      await file(makeFile("data.csv"));
    });

    const result = await useCase.execute({
      experimentId: experiment.id,
      userId: testUserId,
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.uploadTableId).toBe(STUB_UPLOAD_TABLE_ID);
    expect(result.value.uploadTableName).toBe("greenhouse_temps");
    expect(result.value.files).toHaveLength(1);
    expect(result.value.files[0].fileName).toBe("data.csv");

    expect(uploadsRepository.validateTargetTable).toHaveBeenCalledWith({
      experimentId: experiment.id,
      target: { kind: "new", name: "greenhouse_temps" },
    });

    const [stored] = await storedUploads();
    expect(stored).toMatchObject({
      id: result.value.uploadId,
      experimentId: experiment.id,
      uploadTableId: STUB_UPLOAD_TABLE_ID,
      uploadTableName: "greenhouse_temps",
      targetKind: "new",
      sourceKind: "csv",
      status: "queued",
      fileCount: 1,
      jobRunId: 12345,
      createdBy: testUserId,
    });
    expect(databricksPort.triggerDataUploadJob).toHaveBeenCalledWith({
      sourceKind: "csv",
      experimentId: experiment.id,
      experimentName: experiment.name,
      uploadDirectory: stored.uploadDirectory,
      uploadId: result.value.uploadId,
      uploadTableId: STUB_UPLOAD_TABLE_ID,
      uploadTableName: "greenhouse_temps",
      userId: testUserId,
      createdAt: stored.createdAt,
    });
  });

  it("records the upload before the first file is written", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Recorded_First",
      userId: testUserId,
    });
    vi.spyOn(uploadsRepository, "validateTargetTable").mockResolvedValue(
      success({ uploadTableId: STUB_UPLOAD_TABLE_ID, uploadTableName: "greenhouse_temps" }),
    );
    const statusesWhileWriting: string[] = [];
    vi.spyOn(databricksPort, "uploadExperimentData").mockImplementation(async () => {
      const rows = await storedUploads();
      statusesWhileWriting.push(...rows.map((row) => row.status));
      return success({ filePath: "/Volumes/c/centrum/data-imports/.../file" });
    });

    mountMultipart(multipartUploadService, async ({ field, file }) => {
      field("sourceKind", "csv");
      field("targetKind", "new");
      field("targetName", "greenhouse_temps");
      await file(makeFile("data.csv"));
    });

    await useCase.execute({
      experimentId: experiment.id,
      userId: testUserId,
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    expect(statusesWhileWriting).toEqual(["receiving"]);
  });

  it("records the upload under the id the client sent, so it can follow the upload early", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Client_Id",
      userId: testUserId,
    });
    vi.spyOn(uploadsRepository, "validateTargetTable").mockResolvedValue(
      success({ uploadTableId: STUB_UPLOAD_TABLE_ID, uploadTableName: "greenhouse_temps" }),
    );
    const uploadId = faker.string.uuid();

    mountMultipart(multipartUploadService, async ({ field, file }) => {
      field("sourceKind", "csv");
      field("targetKind", "new");
      field("targetName", "greenhouse_temps");
      field("uploadId", uploadId);
      await file(makeFile("data.csv"));
    });

    const result = await useCase.execute({
      experimentId: experiment.id,
      userId: testUserId,
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    assertSuccess(result);
    expect(result.value.uploadId).toBe(uploadId);
    expect((await storedUploads()).map((row) => row.id)).toEqual([uploadId]);
  });

  it("refuses an upload id the client already used", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Client_Id_Reused",
      userId: testUserId,
    });
    const otherTableId = "33333333-3333-3333-3333-333333333333";
    vi.spyOn(uploadsRepository, "validateTargetTable")
      .mockResolvedValueOnce(
        success({ uploadTableId: STUB_UPLOAD_TABLE_ID, uploadTableName: "greenhouse_temps" }),
      )
      .mockResolvedValueOnce(success({ uploadTableId: otherTableId, uploadTableName: "soil" }));
    const uploadId = faker.string.uuid();
    const upload = (fields: Record<string, string>) => {
      mountMultipart(multipartUploadService, async ({ field, file }) => {
        for (const [name, value] of Object.entries(fields)) {
          field(name, value);
        }
        await file(makeFile("data.csv"));
      });
      return useCase.execute({
        experimentId: experiment.id,
        userId: testUserId,
        requestStream: Readable.from([""]),
        requestHeaders: MULTIPART_HEADERS,
      });
    };

    const first = await upload({
      sourceKind: "csv",
      targetKind: "new",
      targetName: "greenhouse_temps",
      uploadId,
    });
    const second = await upload({
      sourceKind: "csv",
      targetKind: "existing",
      uploadTableId: otherTableId,
      uploadId,
    });

    assertSuccess(first);
    assertFailure(second);
    expect(second.error.statusCode).toBe(409);
    expect(await storedUploads()).toHaveLength(1);
  });

  it("notes each file as it arrives, so a long transfer that is still moving is not swept", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_File_Progress",
      userId: testUserId,
    });
    vi.spyOn(uploadsRepository, "validateTargetTable").mockResolvedValue(
      success({ uploadTableId: STUB_UPLOAD_TABLE_ID, uploadTableName: "greenhouse_temps" }),
    );
    const progress = vi.spyOn(uploadsRepository, "markFileReceived");

    mountMultipart(multipartUploadService, async ({ field, file }) => {
      field("sourceKind", "csv");
      field("targetKind", "new");
      field("targetName", "greenhouse_temps");
      await file(makeFile("first.csv"));
      await file(makeFile("second.csv"));
    });

    await useCase.execute({
      experimentId: experiment.id,
      userId: testUserId,
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    expect(progress).toHaveBeenCalledTimes(2);
  });

  it("refuses a second upload creating the same new table while the first is in flight", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Same_New_Table",
      userId: testUserId,
    });
    vi.spyOn(uploadsRepository, "validateTargetTable").mockResolvedValue(
      success({ uploadTableId: STUB_UPLOAD_TABLE_ID, uploadTableName: "greenhouse_temps" }),
    );
    const upload = () => {
      mountMultipart(multipartUploadService, async ({ field, file }) => {
        field("sourceKind", "csv");
        field("targetKind", "new");
        field("targetName", "greenhouse_temps");
        await file(makeFile("data.csv"));
      });
      return useCase.execute({
        experimentId: experiment.id,
        userId: testUserId,
        requestStream: Readable.from([""]),
        requestHeaders: MULTIPART_HEADERS,
      });
    };

    const first = await upload();
    const second = await upload();

    assertSuccess(first);
    assertFailure(second);
    expect(second.error.code).toBe("UPLOAD_TABLE_NAME_TAKEN");
    expect(databricksPort.uploadExperimentData).toHaveBeenCalledTimes(1);
    expect(await storedUploads()).toHaveLength(1);
  });

  it("fails the upload at once when the request breaks off after its files started arriving", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Broken_Off",
      userId: testUserId,
    });
    vi.spyOn(uploadsRepository, "validateTargetTable").mockResolvedValue(
      success({ uploadTableId: STUB_UPLOAD_TABLE_ID, uploadTableName: "greenhouse_temps" }),
    );
    vi.spyOn(multipartUploadService, "parse").mockImplementation(async (input) => {
      input.onField("sourceKind", "csv");
      input.onField("targetKind", "new");
      input.onField("targetName", "greenhouse_temps");
      await input.onFile(makeFile("data.csv"));
      return failure(AppError.badRequest("File 'big.csv' exceeds the maximum allowed size"));
    });

    const result = await useCase.execute({
      experimentId: experiment.id,
      userId: testUserId,
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    assertFailure(result);
    expect(result.error.message).toContain("exceeds the maximum allowed size");
    const [stored] = await storedUploads();
    expect(stored).toMatchObject({ status: "failed", errorCode: "transfer_interrupted" });
    expect(databricksPort.triggerDataUploadJob).not.toHaveBeenCalled();
  });

  it("reads off the rest of a file that Databricks did not take, so the request can end", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Rejected_File",
      userId: testUserId,
    });
    vi.spyOn(uploadsRepository, "validateTargetTable").mockResolvedValue(
      success({ uploadTableId: STUB_UPLOAD_TABLE_ID, uploadTableName: "greenhouse_temps" }),
    );
    vi.spyOn(databricksPort, "uploadExperimentData").mockResolvedValue(
      failure(AppError.internal("Failed to upload file to Databricks: timeout")),
    );
    const rejected = Readable.from(["h\n1"]);

    mountMultipart(multipartUploadService, async ({ field, file }) => {
      field("sourceKind", "csv");
      field("targetKind", "new");
      field("targetName", "greenhouse_temps");
      await file({ ...makeFile("data.csv"), stream: rejected });
    });

    await useCase.execute({
      experimentId: experiment.id,
      userId: testUserId,
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    expect(rejected.readableFlowing).toBe(true);
  });

  it("refuses a contributing collaborator who tries to create a new target table", async () => {
    const collaboratorId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({
      name: "Upload_New_Target_Without_Manage",
      userId: testUserId,
    });
    await testApp.addExperimentCollaborator(experiment.id, collaboratorId);
    const validateTarget = vi.spyOn(uploadsRepository, "validateTargetTable");

    mountMultipart(multipartUploadService, async ({ field, file }) => {
      field("sourceKind", "csv");
      field("targetKind", "new");
      field("targetName", "greenhouse_temps");
      await file(makeFile("data.csv"));
    });

    const result = await useCase.execute({
      experimentId: experiment.id,
      userId: collaboratorId,
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toBe(
      "Creating a new data table requires experiment management access",
    );
    expect(validateTarget).not.toHaveBeenCalled();
    expect(databricksPort.uploadExperimentData).not.toHaveBeenCalled();
  });

  it("lets a contributing collaborator append to an existing target table", async () => {
    const collaboratorId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Existing_Target_Without_Manage",
      userId: testUserId,
    });
    await testApp.addExperimentCollaborator(experiment.id, collaboratorId);
    vi.spyOn(uploadsRepository, "validateTargetTable").mockResolvedValue(
      success({ uploadTableId: STUB_UPLOAD_TABLE_ID, uploadTableName: "greenhouse_temps" }),
    );

    mountMultipart(multipartUploadService, async ({ field, file }) => {
      field("sourceKind", "csv");
      field("targetKind", "existing");
      field("uploadTableId", STUB_UPLOAD_TABLE_ID);
      await file(makeFile("data.csv"));
    });

    const result = await useCase.execute({
      experimentId: experiment.id,
      userId: collaboratorId,
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    assertSuccess(result);
    expect(result.value.uploadTableId).toBe(STUB_UPLOAD_TABLE_ID);
    expect(uploadsRepository.validateTargetTable).toHaveBeenCalledWith({
      experimentId: experiment.id,
      target: { kind: "existing", uploadTableId: STUB_UPLOAD_TABLE_ID },
    });
    expect(databricksPort.uploadExperimentData).toHaveBeenCalledTimes(1);
  });

  it("uploads ambyte through the generic target flow", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Ambyte",
      userId: testUserId,
    });
    vi.spyOn(uploadsRepository, "validateTargetTable").mockResolvedValue(
      success({ uploadTableId: STUB_UPLOAD_TABLE_ID, uploadTableName: "ambyte_20260512" }),
    );

    mountMultipart(multipartUploadService, async ({ field, file }) => {
      field("targetKind", "new");
      field("targetName", "ambyte_20260512");
      await file(makeFile("Ambyte_5/data.txt"));
    });

    const result = await useCase.execute({
      experimentId: experiment.id,
      userId: testUserId,
      fixedSourceKind: "ambyte",
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.files[0].fileName).toBe("Ambyte_5/data.txt");
    expect(databricksPort.triggerDataUploadJob).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKind: "ambyte",
        experimentId: experiment.id,
        experimentName: experiment.name,
      }),
    );
  });

  it("returns conflict when target validation fails for an in-use name", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Conflict",
      userId: testUserId,
    });
    vi.spyOn(uploadsRepository, "validateTargetTable").mockResolvedValue(
      failure(AppError.conflict("A table named 'x' already exists", "UPLOAD_TABLE_NAME_TAKEN")),
    );

    mountMultipart(multipartUploadService, async ({ field, file }) => {
      field("sourceKind", "csv");
      field("targetKind", "new");
      field("targetName", "x");
      await file(makeFile("data.csv"));
    });

    const result = await useCase.execute({
      experimentId: experiment.id,
      userId: testUserId,
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("UPLOAD_TABLE_NAME_TAKEN");
    expect(databricksPort.triggerDataUploadJob).not.toHaveBeenCalled();
  });

  it("rejects a CSV upload that arrives without target form fields", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Missing_Target",
      userId: testUserId,
    });

    mountMultipart(multipartUploadService, async ({ field, file }) => {
      field("sourceKind", "csv");
      await file(makeFile("data.csv"));
    });

    const result = await useCase.execute({
      experimentId: experiment.id,
      userId: testUserId,
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
  });

  it("rejects a CSV with an invalid filename and reports it as an error", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Bad_Filename",
      userId: testUserId,
    });
    vi.spyOn(uploadsRepository, "validateTargetTable").mockResolvedValue(
      success({ uploadTableId: STUB_UPLOAD_TABLE_ID, uploadTableName: "greenhouse_temps" }),
    );

    mountMultipart(multipartUploadService, async ({ field, file }) => {
      field("sourceKind", "csv");
      field("targetKind", "new");
      field("targetName", "greenhouse_temps");
      await file(makeFile("notes.txt"));
    });

    const result = await useCase.execute({
      experimentId: experiment.id,
      userId: testUserId,
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(databricksPort.triggerDataUploadJob).not.toHaveBeenCalled();
    const [stored] = await storedUploads();
    expect(stored).toMatchObject({ status: "failed", errorCode: "no_files", fileCount: null });
  });

  it("returns forbidden when the experiment is archived", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Archived",
      status: "archived",
      userId: testUserId,
    });

    mountMultipart(multipartUploadService, async ({ field, file }) => {
      field("sourceKind", "csv");
      field("targetKind", "new");
      field("targetName", "x");
      await file(makeFile("data.csv"));
    });

    const result = await useCase.execute({
      experimentId: experiment.id,
      userId: testUserId,
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("rejects upload with no files received", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_No_Files",
      userId: testUserId,
    });

    mountMultipart(multipartUploadService, async () => {
      // no file events
    });

    const result = await useCase.execute({
      experimentId: experiment.id,
      userId: testUserId,
      fixedSourceKind: "ambyte",
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
  });

  it("propagates multipart parsing errors", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Parse_Error",
      userId: testUserId,
    });

    vi.spyOn(multipartUploadService, "parse").mockResolvedValue(
      failure(AppError.internal("Error processing upload", "UPLOAD_PARSE_FAILED")),
    );

    const result = await useCase.execute({
      experimentId: experiment.id,
      userId: testUserId,
      fixedSourceKind: "ambyte",
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("UPLOAD_PARSE_FAILED");
  });

  it("rejects a generic upload missing the sourceKind form field", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Missing_SourceKind",
      userId: testUserId,
    });

    mountMultipart(multipartUploadService, async ({ field, file }) => {
      field("targetKind", "new");
      field("targetName", "leaf_traits");
      await file(makeFile("data.csv"));
    });

    const result = await useCase.execute({
      experimentId: experiment.id,
      userId: testUserId,
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(result.error.message).toContain("sourceKind");
  });

  it("rejects a generic upload whose sourceKind form value is not a known kind", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Unknown_SourceKind",
      userId: testUserId,
    });

    mountMultipart(multipartUploadService, async ({ field, file }) => {
      field("sourceKind", "orc");
      field("targetKind", "new");
      field("targetName", "leaf_traits");
      await file(makeFile("data.csv"));
    });

    const result = await useCase.execute({
      experimentId: experiment.id,
      userId: testUserId,
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(result.error.message).toContain("orc");
  });

  it("returns 404 when the experiment does not exist", async () => {
    mountMultipart(multipartUploadService, async ({ field, file }) => {
      field("sourceKind", "csv");
      field("targetKind", "new");
      field("targetName", "leaf_traits");
      await file(makeFile("data.csv"));
    });

    const result = await useCase.execute({
      experimentId: faker.string.uuid(),
      userId: testUserId,
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("leaves the upload queued for the reconciler when its run cannot be started", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Trigger_Failure",
      userId: testUserId,
    });
    vi.spyOn(uploadsRepository, "validateTargetTable").mockResolvedValue(
      success({ uploadTableId: STUB_UPLOAD_TABLE_ID, uploadTableName: "greenhouse_temps" }),
    );
    vi.spyOn(databricksPort, "triggerDataUploadJob").mockResolvedValue(
      failure(AppError.internal("Databricks job trigger failed")),
    );

    mountMultipart(multipartUploadService, async ({ field, file }) => {
      field("sourceKind", "csv");
      field("targetKind", "new");
      field("targetName", "leaf_traits");
      await file(makeFile("data.csv"));
    });

    const result = await useCase.execute({
      experimentId: experiment.id,
      userId: testUserId,
      requestStream: Readable.from([""]),
      requestHeaders: MULTIPART_HEADERS,
    });

    assertSuccess(result);
    const [stored] = await storedUploads();
    expect(stored).toMatchObject({
      id: result.value.uploadId,
      status: "queued",
      fileCount: 1,
      jobRunId: null,
      errorCode: null,
    });
  });
});
