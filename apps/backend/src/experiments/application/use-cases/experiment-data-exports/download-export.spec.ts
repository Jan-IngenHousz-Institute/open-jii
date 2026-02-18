import { faker } from "@faker-js/faker";
import { Readable } from "stream";

import {
  assertFailure,
  assertSuccess,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentDataExportsRepository } from "../../../core/repositories/experiment-data-exports.repository";
import { DownloadExportUseCase } from "./download-export";

describe("DownloadExportUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: DownloadExportUseCase;
  let exportsRepository: ExperimentDataExportsRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(DownloadExportUseCase);
    exportsRepository = testApp.module.get(ExperimentDataExportsRepository);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should successfully download an export and extract filename from path", async () => {
    const experimentId = faker.string.uuid();
    const exportId = faker.string.uuid();
    const userId = faker.string.uuid();
    const mockStream = new Readable({
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      read() {},
    });
    const filePath = `/volumes/catalog/centrum/data-downloads/${experimentId}/raw_data/csv/${exportId}/raw_data.csv`;

    vi.spyOn(exportsRepository, "downloadExport").mockResolvedValue(
      success({ stream: mockStream, filePath, tableName: "raw_data" }),
    );

    const result = await useCase.execute(experimentId, exportId, userId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.stream).toBe(mockStream);
    expect(result.value.filename).toBe(`raw_data-export-${exportId}.csv`);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(exportsRepository.downloadExport).toHaveBeenCalledWith({
      experimentId,
      exportId,
    });
  });

  it("should use fallback filename when path has no segments", async () => {
    const experimentId = faker.string.uuid();
    const exportId = faker.string.uuid();
    const userId = faker.string.uuid();
    const mockStream = new Readable({
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      read() {},
    });

    vi.spyOn(exportsRepository, "downloadExport").mockResolvedValue(
      success({ stream: mockStream, filePath: "", tableName: "" }),
    );

    const result = await useCase.execute(experimentId, exportId, userId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    // When filePath is empty, filename is export-{exportId} with no extension
    expect(result.value.filename).toBe(`export-${exportId}`);
  });

  it("should propagate failure from downloadExport", async () => {
    const experimentId = faker.string.uuid();
    const exportId = faker.string.uuid();
    const userId = faker.string.uuid();

    vi.spyOn(exportsRepository, "downloadExport").mockResolvedValue(
      failure(AppError.notFound("Export not found")),
    );

    const result = await useCase.execute(experimentId, exportId, userId);

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain("Export not found");
  });

  it("should propagate internal error from downloadExport", async () => {
    const experimentId = faker.string.uuid();
    const exportId = faker.string.uuid();
    const userId = faker.string.uuid();

    vi.spyOn(exportsRepository, "downloadExport").mockResolvedValue(
      failure(AppError.internal("Export file path is missing")),
    );

    const result = await useCase.execute(experimentId, exportId, userId);

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain("Export file path is missing");
  });
});
