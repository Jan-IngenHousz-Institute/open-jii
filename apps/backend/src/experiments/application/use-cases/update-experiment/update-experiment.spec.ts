import { NotFoundException } from "@nestjs/common";

import { TestHarness } from "../../../../test/test-harness";
import { UpdateExperimentUseCase } from "./update-experiment";

describe("UpdateExperimentUseCase", () => {
  let useCase: UpdateExperimentUseCase;
  let experimentRepository: any;

  beforeEach(() => {
    experimentRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    };
    useCase = new UpdateExperimentUseCase(experimentRepository);
  });

  it("should update an experiment if it exists", async () => {
    experimentRepository.findOne.mockResolvedValue({ id: "exp1" });
    experimentRepository.update.mockResolvedValue({
      id: "exp1",
      name: "Updated",
    });
    const dto = { name: "Updated" };
    const result = await useCase.execute("exp1", dto);
    expect(experimentRepository.findOne).toHaveBeenCalledWith("exp1");
    expect(experimentRepository.update).toHaveBeenCalledWith("exp1", dto);
    expect(result).toEqual({ id: "exp1", name: "Updated" });
  });

  it("should throw NotFoundException if experiment does not exist", async () => {
    experimentRepository.findOne.mockResolvedValue(undefined);
    await expect(useCase.execute("notfound", { name: "x" })).rejects.toThrow(
      NotFoundException,
    );
  });
});
