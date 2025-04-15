import {
  ChangeExperimentStatusUseCase,
  ExperimentStatus,
} from "./change-experiment-status.use-case";

describe("ChangeExperimentStatusUseCase", () => {
  let useCase: ChangeExperimentStatusUseCase;
  let experimentRepository: any;

  beforeEach(() => {
    experimentRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    };
    useCase = new ChangeExperimentStatusUseCase(experimentRepository);
  });

  it("should change the status of an experiment", async () => {
    experimentRepository.findOne.mockResolvedValue({
      id: "exp1",
      status: "active",
    });
    experimentRepository.update.mockResolvedValue({
      id: "exp1",
      status: "archived",
    });
    const result = await useCase.execute("exp1", "archived");
    expect(experimentRepository.findOne).toHaveBeenCalledWith("exp1");
    expect(experimentRepository.update).toHaveBeenCalledWith("exp1", {
      status: "archived",
    });
    expect(result).toEqual({ id: "exp1", status: "archived" });
  });

  it("should throw NotFoundException if experiment does not exist", async () => {
    experimentRepository.findOne.mockResolvedValue(undefined);
    await expect(useCase.execute("notfound", "archived")).rejects.toThrow(
      "Experiment with ID notfound not found",
    );
  });

  it("should throw BadRequestException for invalid status", async () => {
    experimentRepository.findOne.mockResolvedValue({
      id: "exp1",
      status: "active",
    });
    await expect(
      useCase.execute("exp1", "invalid" as ExperimentStatus),
    ).rejects.toThrow("Invalid status: invalid");
  });
});
