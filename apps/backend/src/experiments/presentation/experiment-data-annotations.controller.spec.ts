import { StatusCodes } from "http-status-codes";

import type {
  AddAnnotationBody,
  AddAnnotationsBulkBody,
  AnnotationRowsAffected,
  DeleteAnnotationsBulkBody,
  UpdateAnnotationBody,
} from "@repo/api";
import { contract } from "@repo/api";

import { success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";
import { AddAnnotationsUseCase } from "../application/use-cases/experiment-data-annotations/add-annotations/add-annotations";
import { DeleteAnnotationsUseCase } from "../application/use-cases/experiment-data-annotations/delete-annotations/delete-annotations";
import { UpdateAnnotationUseCase } from "../application/use-cases/experiment-data-annotations/update-annotation/update-annotation";

describe("ExperimentDataAnnotationsController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let addAnnotationsUseCase: AddAnnotationsUseCase;
  let updateAnnotationUseCase: UpdateAnnotationUseCase;
  let deleteAnnotationsUseCase: DeleteAnnotationsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    addAnnotationsUseCase = testApp.module.get(AddAnnotationsUseCase);
    updateAnnotationUseCase = testApp.module.get(UpdateAnnotationUseCase);
    deleteAnnotationsUseCase = testApp.module.get(DeleteAnnotationsUseCase);

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
        id: "06a9ac24-b888-4a97-a883-16354d2cf63c",
      });

      // Create the request body
      const addAnnotationsData: AddAnnotationBody = {
        tableName: "data_table_1",
        rowId: "row_123",
        annotation: {
          type: "comment",
          content: {
            text: "This is a test comment",
          },
        },
      };

      // Send the request
      const response: SuperTestResponse<AnnotationRowsAffected> = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(addAnnotationsData)
        .expect(StatusCodes.CREATED);

      expect(response.body.rowsAffected).toBe(1);
    });
  });

  describe("addAnnotationsBulk", () => {
    it("Should add multiple annotation to a single row", async () => {
      vi.spyOn(addAnnotationsUseCase, "execute").mockResolvedValue(success({ rowsAffected: 3 }));

      // Construct the path
      const path = testApp.resolvePath(contract.experiments.addAnnotationsBulk.path, {
        id: "06a9ac24-b888-4a97-a883-16354d2cf63c",
      });

      // Create the request body
      const addAnnotationsData: AddAnnotationsBulkBody = {
        tableName: "data_table_1",
        rowIds: ["row_123", "row_456", "row_789"],
        annotation: {
          type: "comment",
          content: {
            text: "This is a test comment",
          },
        },
      };

      // Send the request
      const response: SuperTestResponse<AnnotationRowsAffected> = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(addAnnotationsData)
        .expect(StatusCodes.CREATED);

      expect(response.body.rowsAffected).toBe(3);
    });
  });

  describe("updateAnnotation", () => {
    it("Should update an annotation on a single row", async () => {
      vi.spyOn(updateAnnotationUseCase, "execute").mockResolvedValue(success({ rowsAffected: 1 }));

      // Construct the path
      const path = testApp.resolvePath(contract.experiments.updateAnnotation.path, {
        id: "06a9ac24-b888-4a97-a883-16354d2cf63c",
        annotationId: "9f244bae-22d7-48c1-9459-b02a6846cea8",
      });

      // Create the request body
      const updateAnnotationData: UpdateAnnotationBody = {
        content: {
          text: "This is the modified comment",
        },
      };

      // Send the request
      const response: SuperTestResponse<AnnotationRowsAffected> = await testApp
        .patch(path)
        .withAuth(testUserId)
        .send(updateAnnotationData)
        .expect(StatusCodes.NO_CONTENT);

      expect(response.body.rowsAffected).toBe(undefined);
    });
  });

  describe("deleteAnnotation", () => {
    it("Should delete an annotation from a single row", async () => {
      vi.spyOn(deleteAnnotationsUseCase, "execute").mockResolvedValue(success({ rowsAffected: 1 }));

      // Construct the path
      const path = testApp.resolvePath(contract.experiments.deleteAnnotation.path, {
        id: "06a9ac24-b888-4a97-a883-16354d2cf63c",
        annotationId: "9f244bae-22d7-48c1-9459-b02a6846cea8",
      });

      // Send the request
      const response: SuperTestResponse<AnnotationRowsAffected> = await testApp
        .delete(path)
        .withAuth(testUserId)
        .expect(StatusCodes.NO_CONTENT);

      expect(response.body.rowsAffected).toBe(undefined);
    });
  });

  describe("deleteAnnotationsBulk", () => {
    it("Should delete all comments annotations from multiple rows", async () => {
      vi.spyOn(deleteAnnotationsUseCase, "execute").mockResolvedValue(success({ rowsAffected: 5 }));

      // Construct the path
      const path = testApp.resolvePath(contract.experiments.deleteAnnotationsBulk.path, {
        id: "06a9ac24-b888-4a97-a883-16354d2cf63c",
      });

      // Create the request body
      const deleteAnnotationsBulkData: DeleteAnnotationsBulkBody = {
        tableName: "data_table_1",
        rowIds: ["row_123", "row_456"],
        type: "comment",
      };

      // Send the request
      const response: SuperTestResponse<AnnotationRowsAffected> = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(deleteAnnotationsBulkData)
        .expect(StatusCodes.NO_CONTENT);

      expect(response.body.rowsAffected).toBe(undefined);
    });
  });
});
