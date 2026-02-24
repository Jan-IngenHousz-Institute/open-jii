import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import type { Invitation } from "@repo/api";
import { contract } from "@repo/api";

import { success, failure, AppError } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import { CreateInvitationsUseCase } from "../application/use-cases/create-invitations/create-invitations";
import { GetInvitationsUseCase } from "../application/use-cases/get-invitations/get-invitations";
import type { EmailPort } from "../core/ports/email.port";
import { EMAIL_PORT } from "../core/ports/email.port";

describe("InvitationController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let emailPort: EmailPort;
  let createUseCase: CreateInvitationsUseCase;
  let getUseCase: GetInvitationsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    emailPort = testApp.module.get(EMAIL_PORT);
    createUseCase = testApp.module.get(CreateInvitationsUseCase);
    getUseCase = testApp.module.get(GetInvitationsUseCase);

    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("createInvitations", () => {
    it("should create invitations and return 201", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Controller Create Test",
        userId: testUserId,
      });

      vi.spyOn(emailPort, "sendInvitationNotification").mockResolvedValue(success(undefined));

      const path = testApp.resolvePath(contract.users.createInvitations.path, {});

      const response: SuperTestResponse<Invitation[]> = await testApp
        .post(path)
        .withAuth(testUserId)
        .send({
          invitations: [
            {
              resourceType: "experiment",
              resourceId: experiment.id,
              email: "user1@example.com",
              role: "member",
            },
            {
              resourceType: "experiment",
              resourceId: experiment.id,
              email: "user2@example.com",
              role: "admin",
            },
          ],
        })
        .expect(StatusCodes.CREATED);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        email: "user1@example.com",
        role: "member",
        status: "pending",
        resourceId: experiment.id,
        resourceType: "experiment",
      });
    });

    it("should return 401 if not authenticated", async () => {
      const path = testApp.resolvePath(contract.users.createInvitations.path, {});

      await testApp
        .post(path)
        .withoutAuth()
        .send({
          invitations: [
            {
              resourceType: "experiment",
              resourceId: faker.string.uuid(),
              email: "user@example.com",
              role: "member",
            },
          ],
        })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 400 for invalid body", async () => {
      const path = testApp.resolvePath(contract.users.createInvitations.path, {});

      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ invitations: [] })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 500 when use case returns failure", async () => {
      vi.spyOn(createUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Unexpected error")),
      );

      const path = testApp.resolvePath(contract.users.createInvitations.path, {});

      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({
          invitations: [
            {
              resourceType: "experiment",
              resourceId: faker.string.uuid(),
              email: "test@example.com",
              role: "member",
            },
          ],
        })
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });

  describe("listInvitations", () => {
    it("should return pending invitations for a resource", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Controller List Test",
        userId: testUserId,
      });

      vi.spyOn(emailPort, "sendInvitationNotification").mockResolvedValue(success(undefined));

      // Create an invitation first
      const createPath = testApp.resolvePath(contract.users.createInvitations.path, {});
      await testApp
        .post(createPath)
        .withAuth(testUserId)
        .send({
          invitations: [
            {
              resourceType: "experiment",
              resourceId: experiment.id,
              email: "listed@example.com",
              role: "member",
            },
          ],
        })
        .expect(StatusCodes.CREATED);

      vi.restoreAllMocks();

      // Now list
      const listPath = testApp.resolvePath(contract.users.listInvitations.path, {});

      const response: SuperTestResponse<Invitation[]> = await testApp
        .get(listPath)
        .withAuth(testUserId)
        .query({ resourceType: "experiment", resourceId: experiment.id })
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        email: "listed@example.com",
        status: "pending",
        resourceName: "Controller List Test",
      });
    });

    it("should return 401 if not authenticated", async () => {
      const listPath = testApp.resolvePath(contract.users.listInvitations.path, {});

      await testApp
        .get(listPath)
        .withoutAuth()
        .query({ resourceType: "experiment", resourceId: faker.string.uuid() })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 500 when use case returns failure", async () => {
      vi.spyOn(getUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Unexpected error")),
      );

      const listPath = testApp.resolvePath(contract.users.listInvitations.path, {});

      await testApp
        .get(listPath)
        .withAuth(testUserId)
        .query({ resourceType: "experiment", resourceId: faker.string.uuid() })
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });

  describe("updateInvitationRole", () => {
    it("should update invitation role and return 200", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Controller Update Test",
        userId: testUserId,
      });

      vi.spyOn(emailPort, "sendInvitationNotification").mockResolvedValue(success(undefined));

      const createPath = testApp.resolvePath(contract.users.createInvitations.path, {});
      const createResponse: SuperTestResponse<Invitation[]> = await testApp
        .post(createPath)
        .withAuth(testUserId)
        .send({
          invitations: [
            {
              resourceType: "experiment",
              resourceId: experiment.id,
              email: "update-role@example.com",
              role: "member",
            },
          ],
        })
        .expect(StatusCodes.CREATED);

      vi.restoreAllMocks();

      const invitationId = createResponse.body[0].id;
      const updatePath = testApp.resolvePath(contract.users.updateInvitationRole.path, {
        invitationId,
      });

      const response: SuperTestResponse<Invitation> = await testApp
        .patch(updatePath)
        .withAuth(testUserId)
        .send({ role: "admin" })
        .expect(StatusCodes.OK);

      expect(response.body.role).toBe("admin");
    });

    it("should return 404 for non-existent invitation", async () => {
      const updatePath = testApp.resolvePath(contract.users.updateInvitationRole.path, {
        invitationId: faker.string.uuid(),
      });

      await testApp
        .patch(updatePath)
        .withAuth(testUserId)
        .send({ role: "admin" })
        .expect(StatusCodes.NOT_FOUND);
    });

    it("should return 401 if not authenticated", async () => {
      const updatePath = testApp.resolvePath(contract.users.updateInvitationRole.path, {
        invitationId: faker.string.uuid(),
      });

      await testApp
        .patch(updatePath)
        .withoutAuth()
        .send({ role: "admin" })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("revokeInvitation", () => {
    it("should revoke an invitation and return 204", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Controller Revoke Test",
        userId: testUserId,
      });

      vi.spyOn(emailPort, "sendInvitationNotification").mockResolvedValue(success(undefined));

      const createPath = testApp.resolvePath(contract.users.createInvitations.path, {});
      const createResponse: SuperTestResponse<Invitation[]> = await testApp
        .post(createPath)
        .withAuth(testUserId)
        .send({
          invitations: [
            {
              resourceType: "experiment",
              resourceId: experiment.id,
              email: "revoke@example.com",
              role: "member",
            },
          ],
        })
        .expect(StatusCodes.CREATED);

      vi.restoreAllMocks();

      const invitationId = createResponse.body[0].id;
      const revokePath = testApp.resolvePath(contract.users.revokeInvitation.path, {
        invitationId,
      });

      await testApp.delete(revokePath).withAuth(testUserId).expect(StatusCodes.NO_CONTENT);
    });

    it("should return 404 for non-existent invitation", async () => {
      const revokePath = testApp.resolvePath(contract.users.revokeInvitation.path, {
        invitationId: faker.string.uuid(),
      });

      await testApp.delete(revokePath).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });

    it("should return 400 when revoking an already-revoked invitation", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Controller Double Revoke",
        userId: testUserId,
      });

      vi.spyOn(emailPort, "sendInvitationNotification").mockResolvedValue(success(undefined));

      const createPath = testApp.resolvePath(contract.users.createInvitations.path, {});
      const createResponse: SuperTestResponse<Invitation[]> = await testApp
        .post(createPath)
        .withAuth(testUserId)
        .send({
          invitations: [
            {
              resourceType: "experiment",
              resourceId: experiment.id,
              email: "double-revoke@example.com",
              role: "member",
            },
          ],
        })
        .expect(StatusCodes.CREATED);

      vi.restoreAllMocks();

      const invitationId = createResponse.body[0].id;
      const revokePath = testApp.resolvePath(contract.users.revokeInvitation.path, {
        invitationId,
      });

      await testApp.delete(revokePath).withAuth(testUserId).expect(StatusCodes.NO_CONTENT);

      // Second revoke should fail
      await testApp.delete(revokePath).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const revokePath = testApp.resolvePath(contract.users.revokeInvitation.path, {
        invitationId: faker.string.uuid(),
      });

      await testApp.delete(revokePath).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });
});
