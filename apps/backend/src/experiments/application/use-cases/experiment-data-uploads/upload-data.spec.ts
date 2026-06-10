/* eslint-disable @typescript-eslint/unbound-method */
import { faker } from "@faker-js/faker";
import type { IncomingHttpHeaders } from "http";
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
    expect(result.value.runId).toBe(12345);
    expect(result.value.files).toHaveLength(1);
    expect(result.value.files[0].fileName).toBe("data.csv");

    expect(uploadsRepository.validateTargetTable).toHaveBeenCalledWith({
      experimentId: experiment.id,
      target: { kind: "new", name: "greenhouse_temps" },
    });
    expect(databricksPort.triggerDataUploadJob).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKind: "csv",
        experimentId: experiment.id,
        uploadTableId: STUB_UPLOAD_TABLE_ID,
        uploadTableName: "greenhouse_temps",
        userId: testUserId,
      }),
    );
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
  });

  it("returns forbidden when the user lacks archive access", async () => {
    const otherUserId = await testApp.createTestUser({ email: "other@example.com" });
    const { experiment } = await testApp.createExperiment({
      name: "Upload_Forbidden",
      visibility: "private",
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
      userId: otherUserId,
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

  it("surfaces the adapter failure when triggerDataUploadJob fails", async () => {
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

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain("trigger failed");
  });
});
