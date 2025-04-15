import { NotFoundException } from "@nestjs/common";

import { GetExperimentUseCase } from "./get-experiment.use-case";

describe("GetExperimentUseCase", () => {
  let useCase: GetExperimentUseCase;
  let experimentRepository: any;

  beforeEach(() => {
    experimentRepository = {
      findOne: jest.fn(),
    };
    useCase = new GetExperimentUseCase(experimentRepository);
  });

  it("should return the experiment if found", async () => {
    experimentRepository.findOne.mockResolvedValue({
      id: "exp1",
      name: "Test",
    });
    const result = await useCase.execute("exp1");
    expect(experimentRepository.findOne).toHaveBeenCalledWith("exp1");
    expect(result).toEqual({ id: "exp1", name: "Test" });
  });

  it("should throw NotFoundException if experiment does not exist", async () => {
    experimentRepository.findOne.mockResolvedValue(undefined);
    await expect(useCase.execute("notfound")).rejects.toThrow(
      NotFoundException,
    );
  });
});
