import { ListExperimentMembersUseCase } from "./list-experiment-members.use-case";
import { NotFoundException, ForbiddenException } from "@nestjs/common";

describe("ListExperimentMembersUseCase", () => {
  let useCase: ListExperimentMembersUseCase;
  let experimentRepository: any;

  beforeEach(() => {
    experimentRepository = {
      findOne: jest.fn(),
      hasAccess: jest.fn(),
      getMembers: jest.fn(),
    };
    useCase = new ListExperimentMembersUseCase(experimentRepository);
  });

  it("should return members if user has access", async () => {
    experimentRepository.findOne.mockResolvedValue({ id: "exp1" });
    experimentRepository.hasAccess.mockResolvedValue(true);
    experimentRepository.getMembers.mockResolvedValue([{ userId: "user1" }]);
    const result = await useCase.execute("exp1", "user1");
    expect(result).toEqual([{ userId: "user1" }]);
  });

  it("should throw NotFoundException if experiment does not exist", async () => {
    experimentRepository.findOne.mockResolvedValue(undefined);
    await expect(useCase.execute("exp1", "user1")).rejects.toThrow(NotFoundException);
  });

  it("should throw ForbiddenException if user has no access", async () => {
    experimentRepository.findOne.mockResolvedValue({ id: "exp1" });
    experimentRepository.hasAccess.mockResolvedValue(false);
    await expect(useCase.execute("exp1", "user1")).rejects.toThrow(ForbiddenException);
  });
});
