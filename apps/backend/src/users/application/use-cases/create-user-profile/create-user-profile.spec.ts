import { failure, success, AppError } from "../../../../common/utils/fp-utils";
import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import { CreateUserProfileUseCase } from "./create-user-profile";

describe("CreateUserProfileUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateUserProfileUseCase;
  let mockDatabricksPort: DatabricksPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateUserProfileUseCase);

    // Mock Databricks port
    mockDatabricksPort = testApp.module.get(DATABRICKS_PORT);
    vi.spyOn(mockDatabricksPort, "triggerEnrichedTablesRefreshJob").mockResolvedValue(
      success({ run_id: 12345, number_in_job: 1 }),
    );
  });

  afterEach(() => {
    testApp.afterEach();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should create a user profile for an existing user", async () => {
    const dto = {
      firstName: "Alice",
      lastName: "Smith",
      organization: "TestOrg",
    };

    const result = await useCase.execute(dto, testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toMatchObject({
      firstName: dto.firstName,
      lastName: dto.lastName,
      organization: dto.organization,
    });
  });

  it("should return NOT_FOUND error when user does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const dto = {
      firstName: "Bob",
      lastName: "Jones",
      organization: "OtherOrg",
    };

    const result = await useCase.execute(dto, nonExistentId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should create a user profile with bio", async () => {
    const dto = {
      firstName: "Bob",
      lastName: "Johnson",
      bio: "Experienced data scientist.",
      organization: "DataCorp",
    };

    const result = await useCase.execute(dto, testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toMatchObject({
      firstName: dto.firstName,
      lastName: dto.lastName,
      bio: dto.bio,
      organization: dto.organization,
    });
  });

  it("should trigger enriched tables refresh on new profile creation", async () => {
    const dto = {
      firstName: "Alice",
      lastName: "Smith",
      organization: "TestOrg",
    };

    const result = await useCase.execute(dto, testUserId);

    expect(result.isSuccess()).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockDatabricksPort.triggerEnrichedTablesRefreshJob).toHaveBeenCalledWith(
      "user_id",
      testUserId,
    );
  });

  it("should trigger enriched tables refresh when firstName changes", async () => {
    // Create initial profile
    const initialDto = {
      firstName: "Alice",
      lastName: "Smith",
      organization: "TestOrg",
    };
    await useCase.execute(initialDto, testUserId);

    // Clear previous calls
    vi.clearAllMocks();

    // Update firstName
    const updatedDto = {
      firstName: "Alicia", // Changed
      lastName: "Smith",
      organization: "TestOrg",
    };

    const result = await useCase.execute(updatedDto, testUserId);

    expect(result.isSuccess()).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockDatabricksPort.triggerEnrichedTablesRefreshJob).toHaveBeenCalledWith(
      "user_id",
      testUserId,
    );
  });

  it("should trigger enriched tables refresh when lastName changes", async () => {
    // Create initial profile
    const initialDto = {
      firstName: "Alice",
      lastName: "Smith",
      organization: "TestOrg",
    };
    await useCase.execute(initialDto, testUserId);

    // Clear previous calls
    vi.clearAllMocks();

    // Update lastName
    const updatedDto = {
      firstName: "Alice",
      lastName: "Johnson", // Changed
      organization: "TestOrg",
    };

    const result = await useCase.execute(updatedDto, testUserId);

    expect(result.isSuccess()).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockDatabricksPort.triggerEnrichedTablesRefreshJob).toHaveBeenCalledWith(
      "user_id",
      testUserId,
    );
  });

  it("should trigger enriched tables refresh when activated changes", async () => {
    // Create initial profile
    const initialDto = {
      firstName: "Alice",
      lastName: "Smith",
      organization: "TestOrg",
      activated: true,
    };
    await useCase.execute(initialDto, testUserId);

    // Clear previous calls
    vi.clearAllMocks();

    // Update activated status
    const updatedDto = {
      firstName: "Alice",
      lastName: "Smith",
      organization: "TestOrg",
      activated: false, // Changed
    };

    const result = await useCase.execute(updatedDto, testUserId);

    expect(result.isSuccess()).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockDatabricksPort.triggerEnrichedTablesRefreshJob).toHaveBeenCalledWith(
      "user_id",
      testUserId,
    );
  });

  it("should NOT trigger enriched tables refresh when only bio or organization changes", async () => {
    // Create initial profile
    const initialDto = {
      firstName: "Alice",
      lastName: "Smith",
      bio: "Initial bio",
      organization: "TestOrg",
    };
    await useCase.execute(initialDto, testUserId);

    // Clear previous calls
    vi.clearAllMocks();

    // Update only bio and organization (not relevant fields)
    const updatedDto = {
      firstName: "Alice", // Same
      lastName: "Smith", // Same
      bio: "Updated bio", // Changed but not relevant
      organization: "NewOrg", // Changed but not relevant
    };

    const result = await useCase.execute(updatedDto, testUserId);

    expect(result.isSuccess()).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockDatabricksPort.triggerEnrichedTablesRefreshJob).not.toHaveBeenCalled();
  });

  it("should continue execution even if Databricks job trigger fails", async () => {
    // Mock Databricks failure
    const databricksError = AppError.internal("Databricks error");
    vi.spyOn(mockDatabricksPort, "triggerEnrichedTablesRefreshJob").mockResolvedValue(
      failure(databricksError),
    );

    const dto = {
      firstName: "Alice",
      lastName: "Smith",
      organization: "TestOrg",
    };

    const result = await useCase.execute(dto, testUserId);

    // Should still succeed despite Databricks failure
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toMatchObject({
      firstName: dto.firstName,
      lastName: dto.lastName,
      organization: dto.organization,
    });
  });
});
