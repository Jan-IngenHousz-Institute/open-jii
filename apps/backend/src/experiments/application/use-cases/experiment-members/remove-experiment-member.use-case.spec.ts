import { NotFoundException, ForbiddenException } from "@nestjs/common";

import { RemoveExperimentMemberUseCase } from "./remove-experiment-member.use-case";

describe("RemoveExperimentMemberUseCase", () => {
  let useCase: RemoveExperimentMemberUseCase;
  let experimentRepository: any;

  beforeEach(() => {
    experimentRepository = {
      findOne: jest.fn(),
      getMembers: jest.fn(),
      removeMember: jest.fn(),
    };
    useCase = new RemoveExperimentMemberUseCase(experimentRepository);
  });

  it("should allow a user to remove themselves", async () => {
    experimentRepository.findOne.mockResolvedValue({
      id: "exp1",
      createdBy: "user1",
    });
    experimentRepository.removeMember.mockResolvedValue({});
    await useCase.execute("exp1", "user2", "user2");
    expect(experimentRepository.removeMember).toHaveBeenCalledWith(
      "exp1",
      "user2",
    );
  });

  it("should allow creator to remove a member", async () => {
    experimentRepository.findOne.mockResolvedValue({
      id: "exp1",
      createdBy: "user1",
    });
    experimentRepository.getMembers.mockResolvedValue([]);
    experimentRepository.removeMember.mockResolvedValue({});
    await useCase.execute("exp1", "user2", "user1");
    expect(experimentRepository.removeMember).toHaveBeenCalledWith(
      "exp1",
      "user2",
    );
  });

  it("should throw NotFoundException if experiment does not exist", async () => {
    experimentRepository.findOne.mockResolvedValue(undefined);
    await expect(useCase.execute("exp1", "user2", "user1")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("should throw ForbiddenException if user is not creator or admin", async () => {
    experimentRepository.findOne.mockResolvedValue({
      id: "exp1",
      createdBy: "user1",
    });
    experimentRepository.getMembers.mockResolvedValue([]);
    await expect(useCase.execute("exp1", "user2", "user3")).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("should throw ForbiddenException if trying to remove creator", async () => {
    experimentRepository.findOne.mockResolvedValue({
      id: "exp1",
      createdBy: "user1",
    });
    experimentRepository.getMembers.mockResolvedValue([
      { userId: "user1", role: "admin" },
    ]);
    await expect(useCase.execute("exp1", "user1", "user1")).rejects.toThrow(
      ForbiddenException,
    );
  });
});
