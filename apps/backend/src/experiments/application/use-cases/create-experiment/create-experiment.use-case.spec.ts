import { CreateExperimentUseCase } from "./create-experiment.use-case";

describe("CreateExperimentUseCase", () => {
  let useCase: CreateExperimentUseCase;
  let experimentRepository: any;

  beforeEach(() => {
    experimentRepository = {
      create: jest.fn(),
    };
    useCase = new CreateExperimentUseCase(experimentRepository);
  });

  it("should create an experiment and return its id", async () => {
    experimentRepository.create.mockResolvedValue({ id: "exp1" });
    const dto = { name: "Test", description: "desc" };
    const result = await useCase.execute(dto as any, "user1");
    expect(experimentRepository.create).toHaveBeenCalledWith(dto, "user1");
    expect(result).toEqual({ id: "exp1" });
  });

  // Add more business logic tests as needed
});
