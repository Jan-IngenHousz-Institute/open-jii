import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { AppError, failure, success } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import { CreateExperimentDashboardUseCase } from "../application/use-cases/experiment-dashboards/create-experiment-dashboard";
import { DeleteExperimentDashboardUseCase } from "../application/use-cases/experiment-dashboards/delete-experiment-dashboard";
import { GetExperimentDashboardUseCase } from "../application/use-cases/experiment-dashboards/get-experiment-dashboard";
import { ListExperimentDashboardsUseCase } from "../application/use-cases/experiment-dashboards/list-experiment-dashboards";
import { UpdateExperimentDashboardUseCase } from "../application/use-cases/experiment-dashboards/update-experiment-dashboard";
import type { ExperimentDashboardDto } from "../core/models/experiment-dashboards.model";

const createTestDashboardBody = (overrides: Partial<Record<string, unknown>> = {}) => ({
  name: "Test Dashboard",
  description: "Test Description",
  layout: { columns: 12, rowHeight: 80, gap: 16 },
  widgets: [],
  ...overrides,
});

const createMockDashboardDto = (
  experimentId: string,
  userId: string,
  overrides: Partial<ExperimentDashboardDto> = {},
): ExperimentDashboardDto => ({
  id: faker.string.uuid(),
  experimentId,
  name: "Test Dashboard",
  description: "Test Description",
  layout: { columns: 12, rowHeight: 80, gap: 16 },
  widgets: [],
  createdBy: userId,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("ExperimentDashboardsOrpcController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let listExperimentDashboardsUseCase: ListExperimentDashboardsUseCase;
  let createExperimentDashboardUseCase: CreateExperimentDashboardUseCase;
  let getExperimentDashboardUseCase: GetExperimentDashboardUseCase;
  let updateExperimentDashboardUseCase: UpdateExperimentDashboardUseCase;
  let deleteExperimentDashboardUseCase: DeleteExperimentDashboardUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    listExperimentDashboardsUseCase = testApp.module.get(ListExperimentDashboardsUseCase);
    createExperimentDashboardUseCase = testApp.module.get(CreateExperimentDashboardUseCase);
    getExperimentDashboardUseCase = testApp.module.get(GetExperimentDashboardUseCase);
    updateExperimentDashboardUseCase = testApp.module.get(UpdateExperimentDashboardUseCase);
    deleteExperimentDashboardUseCase = testApp.module.get(DeleteExperimentDashboardUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("listDashboards", () => {
    it("should successfully list experiment dashboards", async () => {
      const experimentId = faker.string.uuid();
      const mockDashboards: ExperimentDashboardDto[] = [
        createMockDashboardDto(experimentId, testUserId, { name: "Dashboard 1" }),
        createMockDashboardDto(experimentId, testUserId, { name: "Dashboard 2" }),
      ];

      vi.spyOn(listExperimentDashboardsUseCase, "execute").mockResolvedValue(
        success(mockDashboards),
      );

      const response: SuperTestResponse<ExperimentDashboardDto[]> = await testApp
        .get(contract.experiments.listExperimentDashboards.path.replace(":id", experimentId))
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({ id: mockDashboards[0].id, name: "Dashboard 1" });
      expect(response.body[1]).toMatchObject({ id: mockDashboards[1].id, name: "Dashboard 2" });
    });

    it("should handle not found errors when listing dashboards", async () => {
      const experimentId = faker.string.uuid();
      const errorMessage = "Experiment not found";

      vi.spyOn(listExperimentDashboardsUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound(errorMessage)),
      );

      await testApp
        .get(contract.experiments.listExperimentDashboards.path.replace(":id", experimentId))
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect((response) => {
          expect(response.body).toHaveProperty("message", errorMessage);
        });
    });
  });

  describe("createDashboard", () => {
    it("should successfully create a dashboard", async () => {
      const experimentId = faker.string.uuid();
      const body = createTestDashboardBody({ name: "New Dashboard" });
      const mockDashboard = createMockDashboardDto(experimentId, testUserId, {
        name: "New Dashboard",
      });

      vi.spyOn(createExperimentDashboardUseCase, "execute").mockResolvedValue(
        success(mockDashboard),
      );

      const response = await testApp
        .post(contract.experiments.createExperimentDashboard.path.replace(":id", experimentId))
        .withAuth(testUserId)
        .send(body)
        .expect(StatusCodes.CREATED);

      expect(response.body).toMatchObject({
        name: "New Dashboard",
        experimentId,
        createdBy: testUserId,
      });
    });

    it("should handle use case errors when creating dashboard", async () => {
      const experimentId = faker.string.uuid();
      const errorMessage = "Failed to create dashboard";

      vi.spyOn(createExperimentDashboardUseCase, "execute").mockResolvedValue(
        failure(AppError.internal(errorMessage)),
      );

      await testApp
        .post(contract.experiments.createExperimentDashboard.path.replace(":id", experimentId))
        .withAuth(testUserId)
        .send(createTestDashboardBody())
        .expect(StatusCodes.INTERNAL_SERVER_ERROR)
        .expect((response) => {
          expect(response.body).toHaveProperty("message", errorMessage);
        });
    });
  });

  describe("getDashboard", () => {
    it("should successfully get a dashboard", async () => {
      const experimentId = faker.string.uuid();
      const dashboardId = faker.string.uuid();
      const mockDashboard = createMockDashboardDto(experimentId, testUserId, { id: dashboardId });

      vi.spyOn(getExperimentDashboardUseCase, "execute").mockResolvedValue(success(mockDashboard));

      const response = await testApp
        .get(
          contract.experiments.getExperimentDashboard.path
            .replace(":id", experimentId)
            .replace(":dashboardId", dashboardId),
        )
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveProperty("id", dashboardId);
      expect(response.body).toHaveProperty("experimentId", experimentId);
    });

    it("should handle not found errors when getting dashboard", async () => {
      const experimentId = faker.string.uuid();
      const dashboardId = faker.string.uuid();
      const errorMessage = "Dashboard not found";

      vi.spyOn(getExperimentDashboardUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound(errorMessage)),
      );

      await testApp
        .get(
          contract.experiments.getExperimentDashboard.path
            .replace(":id", experimentId)
            .replace(":dashboardId", dashboardId),
        )
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect((response) => {
          expect(response.body).toHaveProperty("message", errorMessage);
        });
    });
  });

  describe("updateDashboard", () => {
    it("should successfully update a dashboard", async () => {
      const experimentId = faker.string.uuid();
      const dashboardId = faker.string.uuid();
      const mockUpdated = createMockDashboardDto(experimentId, testUserId, {
        id: dashboardId,
        name: "Updated Dashboard",
      });

      vi.spyOn(updateExperimentDashboardUseCase, "execute").mockResolvedValue(success(mockUpdated));

      const response = await testApp
        .patch(
          contract.experiments.updateExperimentDashboard.path
            .replace(":id", experimentId)
            .replace(":dashboardId", dashboardId),
        )
        .withAuth(testUserId)
        .send({ name: "Updated Dashboard" })
        .expect(StatusCodes.OK);

      expect(response.body).toHaveProperty("id", dashboardId);
      expect(response.body).toHaveProperty("name", "Updated Dashboard");
    });

    it("should handle forbidden errors when updating dashboard", async () => {
      const experimentId = faker.string.uuid();
      const dashboardId = faker.string.uuid();
      const errorMessage = "You do not have permission to modify this dashboard";

      vi.spyOn(updateExperimentDashboardUseCase, "execute").mockResolvedValue(
        failure(AppError.forbidden(errorMessage)),
      );

      await testApp
        .patch(
          contract.experiments.updateExperimentDashboard.path
            .replace(":id", experimentId)
            .replace(":dashboardId", dashboardId),
        )
        .withAuth(testUserId)
        .send({ name: "Updated Dashboard" })
        .expect(StatusCodes.FORBIDDEN)
        .expect((response) => {
          expect(response.body).toHaveProperty("message", errorMessage);
        });
    });
  });

  describe("deleteDashboard", () => {
    it("should successfully delete a dashboard", async () => {
      const experimentId = faker.string.uuid();
      const dashboardId = faker.string.uuid();

      vi.spyOn(deleteExperimentDashboardUseCase, "execute").mockResolvedValue(success(undefined));

      await testApp
        .delete(
          contract.experiments.deleteExperimentDashboard.path
            .replace(":id", experimentId)
            .replace(":dashboardId", dashboardId),
        )
        .withAuth(testUserId)
        .expect(StatusCodes.NO_CONTENT);
    });

    it("should handle not found errors when deleting dashboard", async () => {
      const experimentId = faker.string.uuid();
      const dashboardId = faker.string.uuid();
      const errorMessage = "Dashboard not found";

      vi.spyOn(deleteExperimentDashboardUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound(errorMessage)),
      );

      await testApp
        .delete(
          contract.experiments.deleteExperimentDashboard.path
            .replace(":id", experimentId)
            .replace(":dashboardId", dashboardId),
        )
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect((response) => {
          expect(response.body).toHaveProperty("message", errorMessage);
        });
    });
  });
});
