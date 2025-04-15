import { ListExperimentsUseCase } from "./list-experiments.use-case";

describe("ListExperimentsUseCase", () => {
  let useCase: ListExperimentsUseCase;
  let experimentRepository: any;

  beforeEach(() => {
    experimentRepository = {
      findAll: jest.fn(),
    };
    useCase = new ListExperimentsUseCase(experimentRepository);
  });

  it("should list experiments for a user", async () => {
    const experiments = [{ id: "exp1" }, { id: "exp2" }];
    experimentRepository.findAll.mockResolvedValue(experiments);
    const result = await useCase.execute("user1");
    expect(experimentRepository.findAll).toHaveBeenCalledWith(
      "user1",
      undefined,
    );
    expect(result).toBe(experiments);
  });

  it("should pass filter to repository if provided", async () => {
    const filter = { status: "active" };
    experimentRepository.findAll.mockResolvedValue([]);
    await useCase.execute("user1", filter as any);
    expect(experimentRepository.findAll).toHaveBeenCalledWith("user1", filter);
  });
});
