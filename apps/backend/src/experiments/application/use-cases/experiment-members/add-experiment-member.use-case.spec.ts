import { NotFoundException, ForbiddenException } from "@nestjs/common";

import { AddExperimentMemberUseCase } from "./add-experiment-member.use-case";

describe("AddExperimentMemberUseCase", () => {
  let useCase: AddExperimentMemberUseCase;
  let experimentRepository: any;

  beforeEach(() => {
    experimentRepository = {
      findOne: jest.fn(),
      getMembers: jest.fn(),
      addMember: jest.fn(),
    };
    useCase = new AddExperimentMemberUseCase(experimentRepository);
  });

  it("should add a member if user is creator", async () => {
    experimentRepository.findOne.mockResolvedValue({
      id: "exp1",
      createdBy: "user1",
    });
    experimentRepository.getMembers.mockResolvedValue([]);
    experimentRepository.addMember.mockResolvedValue({});
    await useCase.execute("exp1", { userId: "user2" }, "user1");
    expect(experimentRepository.addMember).toHaveBeenCalledWith(
      "exp1",
      "user2",
      "member",
    );
  });

  it("should add a member if user is admin", async () => {
    experimentRepository.findOne.mockResolvedValue({
      id: "exp1",
      createdBy: "user1",
    });
    experimentRepository.getMembers.mockResolvedValue([
      { userId: "admin", role: "admin" },
    ]);
    experimentRepository.addMember.mockResolvedValue({});
    await useCase.execute("exp1", { userId: "user2" }, "admin");
    expect(experimentRepository.addMember).toHaveBeenCalled();
  });

  it("should throw NotFoundException if experiment does not exist", async () => {
    experimentRepository.findOne.mockResolvedValue(undefined);
    await expect(
      useCase.execute("exp1", { userId: "user2" }, "user1"),
    ).rejects.toThrow(NotFoundException);
  });

  it("should throw ForbiddenException if user is not creator or admin", async () => {
    experimentRepository.findOne.mockResolvedValue({
      id: "exp1",
      createdBy: "user1",
    });
    experimentRepository.getMembers.mockResolvedValue([]);
    await expect(
      useCase.execute("exp1", { userId: "user2" }, "user3"),
    ).rejects.toThrow(ForbiddenException);
  });
});
