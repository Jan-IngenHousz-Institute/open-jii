import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type {
  ExperimentAddAnnotationBody,
  ExperimentAddAnnotationsBulkBody,
  ExperimentAnnotationRowsAffected,
  ExperimentDeleteAnnotationsBulkBody,
  ExperimentUpdateAnnotationBody,
} from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";

import { success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";
import { AddAnnotationsUseCase } from "../application/use-cases/experiment-data-annotations/add-annotations/add-annotations";
import { DeleteAnnotationsUseCase } from "../application/use-cases/experiment-data-annotations/delete-annotations/delete-annotations";
import { UpdateAnnotationUseCase } from "../application/use-cases/experiment-data-annotations/update-annotation/update-annotation";

describe("ExperimentDataAnnotationsController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let experimentId: string;
  let addAnnotationsUseCase: AddAnnotationsUseCase;
  let updateAnnotationUseCase: UpdateAnnotationUseCase;
  let deleteAnnotationsUseCase: DeleteAnnotationsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({
      name: "Annotations controller experiment",
      userId: testUserId,
    });
    experimentId = experiment.id;

    addAnnotationsUseCase = testApp.module.get(AddAnnotationsUseCase);
    updateAnnotationUseCase = testApp.module.get(UpdateAnnotationUseCase);
    deleteAnnotationsUseCase = testApp.module.get(DeleteAnnotationsUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("addAnnotation", () => {
    it("should add an annotation to a single row", async () => {
      vi.spyOn(addAnnotationsUseCase, "execute").mockResolvedValue(success({ rowsAffected: 1 }));

      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.addAnnotation, {
        id: experimentId,
      });

      // Create the request body
      const addAnnotationsData: ExperimentAddAnnotationBody = {
        tableName: "data_table_1",
        rowId: "row_123",
        annotation: {
          type: "comment",
          content: {
            type: "comment",
            text: "This is a test comment",
          },
        },
      };

      // Send the request
      const response: SuperTestResponse<ExperimentAnnotationRowsAffected> = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(addAnnotationsData)
        .expect(StatusCodes.CREATED);

      expect(response.body.rowsAffected).toBe(1);
    });

    it("should return 400 if experiment id is incorrect", async () => {
      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.addAnnotation, {
        id: "wrong-id",
      });

      // Create the request body
      const addAnnotationsData: ExperimentAddAnnotationBody = {
        tableName: "data_table_1",
        rowId: "row_123",
        annotation: {
          type: "comment",
          content: {
            type: "comment",
            text: "This is a test comment",
          },
        },
      };

      // Send the request
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send(addAnnotationsData)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 if tableName is missing", async () => {
      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.addAnnotation, {
        id: experimentId,
      });

      // Create the request body
      const addAnnotationsData = {
        rowId: "row_123",
        annotation: {
          type: "comment",
          content: {
            type: "comment",
            text: "This is a test comment",
          },
        },
      };

      // Send the request
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send(addAnnotationsData)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 when not authenticated", async () => {
      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.addAnnotation, {
        id: experimentId,
      });

      // Create the request body
      const addAnnotationsData: ExperimentAddAnnotationBody = {
        tableName: "data_table_1",
        rowId: "row_123",
        annotation: {
          type: "comment",
          content: {
            type: "comment",
            text: "This is a test comment",
          },
        },
      };

      // Send the request
      await testApp
        .post(path)
        .withoutAuth()
        .send(addAnnotationsData)
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 404 when the experiment does not exist", async () => {
      const executeSpy = vi.spyOn(addAnnotationsUseCase, "execute");
      const path = testApp.resolveOrpcPath(contract.experiments.addAnnotation, {
        id: "00000000-0000-0000-0000-000000000000",
      });
      const addAnnotationsData: ExperimentAddAnnotationBody = {
        tableName: "data_table_1",
        rowId: "row_123",
        annotation: {
          type: "comment",
          content: { type: "comment", text: "This is a test comment" },
        },
      };

      await testApp
        .post(path)
        .withAuth(testUserId)
        .send(addAnnotationsData)
        .expect(StatusCodes.NOT_FOUND);

      expect(executeSpy).not.toHaveBeenCalled();
    });

    it("should return 403 for a non-member even when the experiment is public", async () => {
      const ownerId = await testApp.createTestUser({});
      const { experiment } = await testApp.createExperiment({
        name: "Public annotations experiment",
        userId: ownerId,
        visibility: "public",
      });
      const executeSpy = vi.spyOn(addAnnotationsUseCase, "execute");
      const path = testApp.resolveOrpcPath(contract.experiments.addAnnotation, {
        id: experiment.id,
      });
      const addAnnotationsData: ExperimentAddAnnotationBody = {
        tableName: "data_table_1",
        rowId: "row_123",
        annotation: {
          type: "comment",
          content: { type: "comment", text: "This is a test comment" },
        },
      };

      await testApp
        .post(path)
        .withAuth(testUserId)
        .send(addAnnotationsData)
        .expect(StatusCodes.FORBIDDEN);

      expect(executeSpy).not.toHaveBeenCalled();
    });
  });

  describe("addAnnotationsBulk", () => {
    it("should add multiple annotation to a single row", async () => {
      vi.spyOn(addAnnotationsUseCase, "execute").mockResolvedValue(success({ rowsAffected: 3 }));

      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.addAnnotationsBulk, {
        id: experimentId,
      });

      // Create the request body
      const addAnnotationsData: ExperimentAddAnnotationsBulkBody = {
        tableName: "data_table_1",
        rowIds: ["row_123", "row_456", "row_789"],
        annotation: {
          type: "comment",
          content: {
            type: "comment",
            text: "This is a test comment",
          },
        },
      };

      // Send the request
      const response: SuperTestResponse<ExperimentAnnotationRowsAffected> = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(addAnnotationsData)
        .expect(StatusCodes.CREATED);

      expect(response.body.rowsAffected).toBe(3);
    });

    it("should return 400 if experiment id is incorrect", async () => {
      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.addAnnotationsBulk, {
        id: "wrong-id",
      });

      // Create the request body
      const addAnnotationsData: ExperimentAddAnnotationsBulkBody = {
        tableName: "data_table_1",
        rowIds: ["row_123", "row_456", "row_789"],
        annotation: {
          type: "comment",
          content: {
            type: "comment",
            text: "This is a test comment",
          },
        },
      };

      // Send the request
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send(addAnnotationsData)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 if annotation type is unknown", async () => {
      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.addAnnotationsBulk, {
        id: experimentId,
      });

      // Create the request body
      const addAnnotationsData = {
        tableName: "data_table_1",
        rowIds: ["row_123", "row_456", "row_789"],
        annotation: {
          type: "unknown-type",
          content: {
            type: "comment",
            text: "This is a test comment",
          },
        },
      };

      // Send the request
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send(addAnnotationsData)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 when not authenticated", async () => {
      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.addAnnotationsBulk, {
        id: experimentId,
      });

      // Create the request body
      const addAnnotationsData: ExperimentAddAnnotationsBulkBody = {
        tableName: "data_table_1",
        rowIds: ["row_123", "row_456", "row_789"],
        annotation: {
          type: "comment",
          content: {
            type: "comment",
            text: "This is a test comment",
          },
        },
      };

      // Send the request
      await testApp
        .post(path)
        .withoutAuth()
        .send(addAnnotationsData)
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("updateAnnotation", () => {
    it("should update an annotation on a single row", async () => {
      vi.spyOn(updateAnnotationUseCase, "execute").mockResolvedValue(success({ rowsAffected: 1 }));

      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.updateAnnotation, {
        id: experimentId,
        annotationId: "9f244bae-22d7-48c1-9459-b02a6846cea8",
      });

      // Create the request body
      const updateAnnotationData: ExperimentUpdateAnnotationBody = {
        content: {
          type: "comment",
          text: "This is the modified comment",
        },
      };

      // Send the request
      const response: SuperTestResponse<ExperimentAnnotationRowsAffected> = await testApp
        .patch(path)
        .withAuth(testUserId)
        .send(updateAnnotationData)
        .expect(StatusCodes.OK);

      expect(response.body.rowsAffected).toBe(1);
    });

    it("should return 400 if experiment id is incorrect", async () => {
      vi.spyOn(updateAnnotationUseCase, "execute").mockResolvedValue(success({ rowsAffected: 1 }));

      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.updateAnnotation, {
        id: "wrong-id",
        annotationId: "9f244bae-22d7-48c1-9459-b02a6846cea8",
      });

      // Create the request body
      const updateAnnotationData: ExperimentUpdateAnnotationBody = {
        content: {
          type: "comment",
          text: "This is the modified comment",
        },
      };

      // Send the request
      await testApp
        .patch(path)
        .withAuth(testUserId)
        .send(updateAnnotationData)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 if annotation id is incorrect", async () => {
      vi.spyOn(updateAnnotationUseCase, "execute").mockResolvedValue(success({ rowsAffected: 1 }));

      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.updateAnnotation, {
        id: experimentId,
        annotationId: "wrong-id",
      });

      // Create the request body
      const updateAnnotationData: ExperimentUpdateAnnotationBody = {
        content: {
          type: "comment",
          text: "This is the modified comment",
        },
      };

      // Send the request
      await testApp
        .patch(path)
        .withAuth(testUserId)
        .send(updateAnnotationData)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 if body is incorrect", async () => {
      vi.spyOn(updateAnnotationUseCase, "execute").mockResolvedValue(success({ rowsAffected: 1 }));

      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.updateAnnotation, {
        id: experimentId,
        annotationId: "9f244bae-22d7-48c1-9459-b02a6846cea8",
      });

      // Create the request body
      const updateAnnotationData = {
        content: {
          wrong: "This is the modified comment",
        },
      };

      // Send the request
      await testApp
        .patch(path)
        .withAuth(testUserId)
        .send(updateAnnotationData)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 when not authenticated", async () => {
      vi.spyOn(updateAnnotationUseCase, "execute").mockResolvedValue(success({ rowsAffected: 1 }));

      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.updateAnnotation, {
        id: experimentId,
        annotationId: "9f244bae-22d7-48c1-9459-b02a6846cea8",
      });

      // Create the request body
      const updateAnnotationData: ExperimentUpdateAnnotationBody = {
        content: {
          type: "comment",
          text: "This is the modified comment",
        },
      };

      // Send the request
      await testApp
        .patch(path)
        .withoutAuth()
        .send(updateAnnotationData)
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("deleteAnnotation", () => {
    it("should delete an annotation from a single row", async () => {
      vi.spyOn(deleteAnnotationsUseCase, "execute").mockResolvedValue(success({ rowsAffected: 1 }));

      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.deleteAnnotation, {
        id: experimentId,
        annotationId: "9f244bae-22d7-48c1-9459-b02a6846cea8",
      });

      // Send the request
      const response: SuperTestResponse<ExperimentAnnotationRowsAffected> = await testApp
        .delete(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body.rowsAffected).toBe(1);
    });

    it("should return 400 if experiment id is incorrect", async () => {
      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.deleteAnnotation, {
        id: "wrong-id",
        annotationId: "9f244bae-22d7-48c1-9459-b02a6846cea8",
      });

      // Send the request
      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 if annotation id is incorrect", async () => {
      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.deleteAnnotation, {
        id: experimentId,
        annotationId: "wrong-id",
      });

      // Send the request
      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 when not authenticated", async () => {
      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.deleteAnnotation, {
        id: experimentId,
        annotationId: "9f244bae-22d7-48c1-9459-b02a6846cea8",
      });

      // Send the request
      await testApp.delete(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("deleteAnnotationsBulk", () => {
    it("should delete all comments annotations from multiple rows", async () => {
      vi.spyOn(deleteAnnotationsUseCase, "execute").mockResolvedValue(success({ rowsAffected: 5 }));

      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.deleteAnnotationsBulk, {
        id: experimentId,
      });

      // Create the request body
      const deleteAnnotationsBulkData: ExperimentDeleteAnnotationsBulkBody = {
        tableName: "data_table_1",
        rowIds: ["row_123", "row_456"],
        type: "comment",
      };

      // Send the request
      const response: SuperTestResponse<ExperimentAnnotationRowsAffected> = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(deleteAnnotationsBulkData)
        .expect(StatusCodes.OK);

      expect(response.body.rowsAffected).toBe(5);
    });

    it("should return 400 if experiment id is incorrect", async () => {
      vi.spyOn(deleteAnnotationsUseCase, "execute").mockResolvedValue(success({ rowsAffected: 5 }));

      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.deleteAnnotationsBulk, {
        id: "wrong-id",
      });

      // Create the request body
      const deleteAnnotationsBulkData: ExperimentDeleteAnnotationsBulkBody = {
        tableName: "data_table_1",
        rowIds: ["row_123", "row_456"],
        type: "comment",
      };

      // Send the request
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send(deleteAnnotationsBulkData)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 if tableName is missing", async () => {
      vi.spyOn(deleteAnnotationsUseCase, "execute").mockResolvedValue(success({ rowsAffected: 5 }));

      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.deleteAnnotationsBulk, {
        id: experimentId,
      });

      // Create the request body
      const deleteAnnotationsBulkData = {
        rowIds: ["row_123", "row_456"],
        type: "comment",
      };

      // Send the request
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send(deleteAnnotationsBulkData)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 when not authenticated", async () => {
      vi.spyOn(deleteAnnotationsUseCase, "execute").mockResolvedValue(success({ rowsAffected: 5 }));

      // Construct the path
      const path = testApp.resolveOrpcPath(contract.experiments.deleteAnnotationsBulk, {
        id: experimentId,
      });

      // Create the request body
      const deleteAnnotationsBulkData: ExperimentDeleteAnnotationsBulkBody = {
        tableName: "data_table_1",
        rowIds: ["row_123", "row_456"],
        type: "comment",
      };

      // Send the request
      await testApp
        .post(path)
        .withoutAuth()
        .send(deleteAnnotationsBulkData)
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("contributor authorization", () => {
    // These routes require experiment MEMBERSHIP (not mere read access),
    // enforced by @CanContributeToExperiment: a non-member must be rejected even
    // on a public experiment. `addAnnotation` is covered by the public-experiment
    // test above; this pins the decorator on the remaining routes so removing any
    // one of them fails here.
    it.each([
      {
        name: "add annotations (bulk)",
        request: (id: string, userId: string) =>
          testApp
            .post(testApp.resolveOrpcPath(contract.experiments.addAnnotationsBulk, { id }))
            .withAuth(userId)
            .send({}),
      },
      {
        name: "update annotation",
        request: (id: string, userId: string) =>
          testApp
            .patch(
              testApp.resolveOrpcPath(contract.experiments.updateAnnotation, {
                id,
                annotationId: faker.string.uuid(),
              }),
            )
            .withAuth(userId)
            .send({}),
      },
      {
        name: "delete annotation",
        request: (id: string, userId: string) =>
          testApp
            .delete(
              testApp.resolveOrpcPath(contract.experiments.deleteAnnotation, {
                id,
                annotationId: faker.string.uuid(),
              }),
            )
            .withAuth(userId),
      },
      {
        name: "delete annotations (bulk)",
        request: (id: string, userId: string) =>
          testApp
            .post(testApp.resolveOrpcPath(contract.experiments.deleteAnnotationsBulk, { id }))
            .withAuth(userId)
            .send({}),
      },
    ])("rejects a non-member from $name even on a public experiment", async ({ request }) => {
      const ownerId = await testApp.createTestUser({});
      const { experiment } = await testApp.createExperiment({
        name: "Public annotations authorization experiment",
        userId: ownerId,
        visibility: "public",
      });

      await request(experiment.id, testUserId).expect(StatusCodes.FORBIDDEN);
    });
  });
});
