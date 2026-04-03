import { vi, describe, it, expect, beforeEach } from "vitest";

import {
  success,
  failure,
  AppError,
  assertSuccess,
  assertFailure,
} from "../../../../common/utils/fp-utils";
import type { UserRepository } from "../../../core/repositories/user.repository";
import { GetDeletionCheckUseCase } from "./get-deletion-check";

describe("GetDeletionCheckUseCase", () => {
  let useCase: GetDeletionCheckUseCase;
  let userRepository: {
    findOne: ReturnType<typeof vi.fn>;
    getExperimentsWhereOnlyAdmin: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    userRepository = {
      findOne: vi.fn(),
      getExperimentsWhereOnlyAdmin: vi.fn(),
    };
    useCase = new GetDeletionCheckUseCase(userRepository as unknown as UserRepository);
  });

  it("should return canDelete true when user has no blocking experiments", async () => {
    userRepository.findOne.mockResolvedValue(success({ id: "user-1", email: "test@example.com" }));
    userRepository.getExperimentsWhereOnlyAdmin.mockResolvedValue(success([]));

    const result = await useCase.execute("user-1");

    assertSuccess(result);
    expect(result.value.canDelete).toBe(true);
    expect(result.value.blockingExperiments).toEqual([]);
  });

  it("should return canDelete false with blocking experiments", async () => {
    const blocking = [
      { id: "exp-1", name: "Active Experiment", status: "active" },
      { id: "exp-2", name: "Archived Experiment", status: "archived" },
    ];
    userRepository.findOne.mockResolvedValue(success({ id: "user-1", email: "test@example.com" }));
    userRepository.getExperimentsWhereOnlyAdmin.mockResolvedValue(success(blocking));

    const result = await useCase.execute("user-1");

    assertSuccess(result);
    expect(result.value.canDelete).toBe(false);
    expect(result.value.blockingExperiments).toEqual(blocking);
  });

  it("should return NOT_FOUND when user does not exist", async () => {
    userRepository.findOne.mockResolvedValue(success(null));

    const result = await useCase.execute("non-existent");

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should propagate repository failure from findOne", async () => {
    userRepository.findOne.mockResolvedValue(failure(AppError.internal("DB error")));

    const result = await useCase.execute("user-1");

    assertFailure(result);
    expect(result.error.message).toBe("DB error");
  });

  it("should propagate repository failure from getExperimentsWhereOnlyAdmin", async () => {
    userRepository.findOne.mockResolvedValue(success({ id: "user-1", email: "test@example.com" }));
    userRepository.getExperimentsWhereOnlyAdmin.mockResolvedValue(
      failure(AppError.internal("Query failed")),
    );

    const result = await useCase.execute("user-1");

    assertFailure(result);
    expect(result.error.message).toBe("Query failed");
  });
});
