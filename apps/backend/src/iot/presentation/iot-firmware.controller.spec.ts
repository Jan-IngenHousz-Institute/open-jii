import { StatusCodes } from "http-status-codes";

import { FEATURE_FLAGS } from "@repo/analytics";
import { contract } from "@repo/api/contract";
import type { FirmwareReleaseList } from "@repo/api/domains/iot/firmware/iot-firmware.schema";

import { AnalyticsAdapter } from "../../common/modules/analytics/analytics.adapter";
import { AppError, failure, success } from "../../common/utils/fp-utils";
import type { MockAnalyticsAdapter } from "../../test/mocks/adapters/analytics.adapter.mock";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";
import { ListIotFirmwareReleasesUseCase } from "../application/use-cases/list-iot-firmware-releases/list-iot-firmware-releases";

const RELEASE = {
  version: "v1.3.0",
  name: "Spring release",
  publishedAt: "2026-08-01T10:00:00.000Z",
  prerelease: false,
  latest: true,
  notesHtml: "<ul><li>fixes</li></ul>",
  releaseUrl: "https://github.com/org/repo/releases/tag/v1.3.0",
  assets: [
    {
      name: "firmware.bin",
      sizeBytes: 2048,
      downloadUrl: "https://github.com/org/repo/releases/download/v1.3.0/firmware.bin",
    },
  ],
};

describe("IotFirmwareController", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let analyticsAdapter: MockAnalyticsAdapter;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    analyticsAdapter = testApp.module.get(AnalyticsAdapter);
    analyticsAdapter.setFlag(FEATURE_FLAGS.IOT_DEVICES, true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const path = (family: string) =>
    testApp.resolveOrpcPath(contract.iot.listIotFirmwareReleases, { family });

  it("returns the family's releases (200)", async () => {
    const useCase = testApp.module.get(ListIotFirmwareReleasesUseCase);
    vi.spyOn(useCase, "execute").mockResolvedValue(success([RELEASE]));

    const response: SuperTestResponse<FirmwareReleaseList> = await testApp
      .get(path("ambyte"))
      .withAuth(userId)
      .expect(StatusCodes.OK);

    expect(response.body.releases).toEqual([RELEASE]);
  });

  it("returns 403 when the device registry is disabled", async () => {
    analyticsAdapter.setFlag(FEATURE_FLAGS.IOT_DEVICES, false);

    await testApp.get(path("ambyte")).withAuth(userId).expect(StatusCodes.FORBIDDEN);
  });

  it("returns 401 when unauthenticated", async () => {
    await testApp.get(path("ambyte")).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
  });

  it("rejects a family with no JII firmware line (400)", async () => {
    await testApp.get(path("mobile")).withAuth(userId).expect(StatusCodes.BAD_REQUEST);
  });

  it("maps a use-case failure through the error contract (500)", async () => {
    const useCase = testApp.module.get(ListIotFirmwareReleasesUseCase);
    vi.spyOn(useCase, "execute").mockResolvedValue(failure(AppError.internal("boom")));

    await testApp.get(path("ambyte")).withAuth(userId).expect(StatusCodes.INTERNAL_SERVER_ERROR);
  });

  it("surfaces an unconfigured family as not found (404)", async () => {
    const useCase = testApp.module.get(ListIotFirmwareReleasesUseCase);
    vi.spyOn(useCase, "execute").mockResolvedValue(
      failure(AppError.notFound("No firmware repository is configured for minipar")),
    );

    await testApp.get(path("minipar")).withAuth(userId).expect(StatusCodes.NOT_FOUND);
  });
});
