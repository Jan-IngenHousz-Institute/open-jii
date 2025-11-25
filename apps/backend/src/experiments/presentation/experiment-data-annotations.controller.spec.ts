import { StatusCodes } from "http-status-codes";

import type { AddAnnotationBody, AnnotationRowsAffected } from "@repo/api";
import { contract } from "@repo/api";

import { success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";
import { AddAnnotationsUseCase } from "../application/use-cases/experiment-data-annotations/add-annotations/add-annotations";

describe("ExperimentDataAnnotationsController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let addAnnotationsUseCase: AddAnnotationsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    addAnnotationsUseCase = testApp.module.get(AddAnnotationsUseCase);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("addAnnotation", () => {
    it("Should add an annotation to a single row", async () => {
      vi.spyOn(addAnnotationsUseCase, "execute").mockResolvedValue(success({ rowsAffected: 1 }));

      // Construct the path
      const path = testApp.resolvePath(contract.experiments.addAnnotation.path, {
        id: "experiment_123",
      });

      // Create the request body
      const addAnnotationData: AddAnnotationBody = {
        tableName: "data_table_1",
        rowId: "row_123",
        annotation: {
          type: "comment",
          content: {
            text: "This is a test comment",
          },
        },
      };

      // TODO: It results 400 instead or 201, need to investigate
      // Send the request
      const response: SuperTestResponse<AnnotationRowsAffected> = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(addAnnotationData)
        .expect(StatusCodes.CREATED);

      expect(response.body.rowsAffected).toBe(1);
    });
  });
});
