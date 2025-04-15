import { HttpStatus } from "@nestjs/common";
import { and, eq } from "database";

import { TestHarness } from "../../../test/test-harness";
import { experimentMembers } from "../../core/models/experiment.model";

describe("Experiment Members Use Cases (Integration)", () => {
  const testApp = TestHarness.App;

  beforeAll(async () => {
    await testApp.setup();
    const userId = await testApp.createTestUser();
    testApp.testUserId = userId;
  });

  beforeEach(async () => {
    await testApp.beforeEach();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("GET /experiments/:id/members", () => {
    it("should list all experiment members", async () => {
      // Arrange
      const experiment = await testApp.createExperiment({
        name: "Experiment With Members",
      });

      const otherUserId = await testApp.createTestUser("other@example.com");
      await testApp.addExperimentMember(experiment.id, otherUserId, "admin");

      // Act
      const path = testApp.resolvePath("/experiments/:id/members", {
        id: experiment.id,
      });
      const response = await testApp.get(path).expect(HttpStatus.OK);

      // Assert
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        userId: otherUserId,
        role: "admin",
      });
    });

    it("should return 404 for non-existent experiment", async () => {
      // Arrange
      const nonExistentId = "11111111-1111-1111-1111-111111111111";

      // Act & Assert
      const path = testApp.resolvePath("/experiments/:id/members", {
        id: nonExistentId,
      });
      await testApp.get(path).expect(HttpStatus.NOT_FOUND);
    });
  });

  describe("POST /experiments/:id/members", () => {
    it("should add a new member to an experiment", async () => {
      // Arrange
      const experiment = await testApp.createExperiment({
        name: "Experiment For Adding Member",
      });

      const newMemberId = await testApp.createTestUser("newmember@example.com");
      const memberData = {
        userId: newMemberId,
        role: "member",
      };

      // Act
      const path = testApp.resolvePath("/experiments/:id/members", {
        id: experiment.id,
      });
      await testApp.post(path).send(memberData).expect(HttpStatus.CREATED);

      // Assert
      const members = await testApp.database
        .select()
        .from(experimentMembers)
        .where(
          and(
            eq(experimentMembers.experimentId, experiment.id),
            eq(experimentMembers.userId, newMemberId),
          ),
        );

      expect(members).toHaveLength(1);
      expect(members[0].role).toBe("member");
    });

    it("should update role if member already exists", async () => {
      // Arrange
      const experiment = await testApp.createExperiment({
        name: "Experiment For Updating Member",
      });

      const memberId = await testApp.createTestUser(
        "existingmember@example.com",
      );
      await testApp.addExperimentMember(experiment.id, memberId, "member");

      const updateData = {
        userId: memberId,
        role: "admin",
      };

      // Act
      const path = testApp.resolvePath("/experiments/:id/members", {
        id: experiment.id,
      });
      await testApp.post(path).send(updateData).expect(HttpStatus.CREATED);

      // Assert
      const members = await testApp.database
        .select()
        .from(experimentMembers)
        .where(
          and(
            eq(experimentMembers.experimentId, experiment.id),
            eq(experimentMembers.userId, memberId),
          ),
        );

      expect(members).toHaveLength(1);
      expect(members[0].role).toBe("admin");
    });

    it("should return 403 when non-creator/admin tries to add member", async () => {
      // Arrange
      const ownerUserId = await testApp.createTestUser("owner@example.com");
      const experiment = await testApp.createExperiment({
        name: "Protected Experiment",
        userId: ownerUserId,
      });

      const newMemberId = await testApp.createTestUser(
        "anothermember@example.com",
      );
      const memberData = {
        userId: newMemberId,
        role: "member",
      };

      // Act & Assert
      const path = testApp.resolvePath("/experiments/:id/members", {
        id: experiment.id,
      });
      await testApp.post(path).send(memberData).expect(HttpStatus.FORBIDDEN);
    });
  });

  describe("DELETE /experiments/:id/members/:memberId", () => {
    it("should remove a member from an experiment", async () => {
      // Arrange
      const experiment = await testApp.createExperiment({
        name: "Experiment For Removing Member",
      });

      const memberId = await testApp.createTestUser(
        "membertoremove@example.com",
      );
      await testApp.addExperimentMember(experiment.id, memberId, "member");

      // Act
      const path = testApp.resolvePath("/experiments/:id/members/:memberId", {
        id: experiment.id,
        memberId: memberId,
      });

      await testApp.delete(path).expect(HttpStatus.NO_CONTENT);

      // Assert
      const members = await testApp.database
        .select()
        .from(experimentMembers)
        .where(
          and(
            eq(experimentMembers.experimentId, experiment.id),
            eq(experimentMembers.userId, memberId),
          ),
        );

      expect(members).toHaveLength(0);
    });

    it("should allow members to remove themselves", async () => {
      // Arrange
      const ownerUserId = await testApp.createTestUser("owner2@example.com");
      const experiment = await testApp.createExperiment({
        name: "Self-Leave Experiment",
        userId: ownerUserId,
      });

      await testApp.addExperimentMember(
        experiment.id,
        testApp.testUserId,
        "member",
      );

      // Act
      const path = testApp.resolvePath("/experiments/:id/members/:memberId", {
        id: experiment.id,
        memberId: testApp.testUserId,
      });

      await testApp.delete(path).expect(HttpStatus.NO_CONTENT);

      // Assert
      const members = await testApp.database
        .select()
        .from(experimentMembers)
        .where(
          and(
            eq(experimentMembers.experimentId, experiment.id),
            eq(experimentMembers.userId, testApp.testUserId),
          ),
        );

      expect(members).toHaveLength(0);
    });

    it("should return 403 when trying to remove another member without permission", async () => {
      // Arrange
      const ownerUserId = await testApp.createTestUser("owner3@example.com");
      const experiment = await testApp.createExperiment({
        name: "Protected Removal Experiment",
        userId: ownerUserId,
      });

      const memberId = await testApp.createTestUser(
        "protectedmember@example.com",
      );
      await testApp.addExperimentMember(experiment.id, memberId, "member");

      // Act & Assert
      const path = testApp.resolvePath("/experiments/:id/members/:memberId", {
        id: experiment.id,
        memberId: memberId,
      });

      await testApp.delete(path).expect(HttpStatus.FORBIDDEN);
    });
  });
});
