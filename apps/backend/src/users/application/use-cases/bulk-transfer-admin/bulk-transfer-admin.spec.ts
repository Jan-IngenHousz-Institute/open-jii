import { vi, describe, it, expect, beforeEach } from "vitest";

import {
  success,
  failure,
  AppError,
  assertSuccess,
  assertFailure,
} from "../../../../common/utils/fp-utils";
import type { ExperimentMemberRepository } from "../../../../experiments/core/repositories/experiment-member.repository";
import type { UserRepository } from "../../../core/repositories/user.repository";
import { BulkTransferAdminUseCase } from "./bulk-transfer-admin";

describe("BulkTransferAdminUseCase", () => {
  let useCase: BulkTransferAdminUseCase;
  let userRepository: {
    findOne: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    getExperimentsWhereOnlyAdmin: ReturnType<typeof vi.fn>;
  };
  let experimentMemberRepository: {
    getMemberRole: ReturnType<typeof vi.fn>;
    addMembers: ReturnType<typeof vi.fn>;
    updateMemberRole: ReturnType<typeof vi.fn>;
  };

  const mockUser = { id: "user-1", email: "owner@example.com" };
  const mockTarget = { id: "user-2", email: "colleague@example.com" };

  beforeEach(() => {
    userRepository = {
      findOne: vi.fn(),
      findByEmail: vi.fn(),
      getExperimentsWhereOnlyAdmin: vi.fn(),
    };
    experimentMemberRepository = {
      getMemberRole: vi.fn(),
      addMembers: vi.fn(),
      updateMemberRole: vi.fn(),
    };
    useCase = new BulkTransferAdminUseCase(
      userRepository as unknown as UserRepository,
      experimentMemberRepository as unknown as ExperimentMemberRepository,
    );
  });

  it("should transfer admin to a non-member by adding them", async () => {
    userRepository.findOne.mockResolvedValue(success(mockUser));
    userRepository.findByEmail.mockResolvedValue(success(mockTarget));
    userRepository.getExperimentsWhereOnlyAdmin.mockResolvedValue(
      success([{ id: "exp-1", name: "Test", status: "active" }]),
    );
    experimentMemberRepository.getMemberRole.mockResolvedValue(success(null));
    experimentMemberRepository.addMembers.mockResolvedValue(success([]));

    const result = await useCase.execute("user-1", "colleague@example.com");

    assertSuccess(result);
    expect(result.value.transferred).toBe(1);
    expect(experimentMemberRepository.addMembers).toHaveBeenCalledWith("exp-1", [
      { userId: "user-2", role: "admin" },
    ]);
  });

  it("should promote existing member to admin", async () => {
    userRepository.findOne.mockResolvedValue(success(mockUser));
    userRepository.findByEmail.mockResolvedValue(success(mockTarget));
    userRepository.getExperimentsWhereOnlyAdmin.mockResolvedValue(
      success([{ id: "exp-1", name: "Test", status: "active" }]),
    );
    experimentMemberRepository.getMemberRole.mockResolvedValue(success("member"));
    experimentMemberRepository.updateMemberRole.mockResolvedValue(success({ role: "admin" }));

    const result = await useCase.execute("user-1", "colleague@example.com");

    assertSuccess(result);
    expect(result.value.transferred).toBe(1);
    expect(experimentMemberRepository.updateMemberRole).toHaveBeenCalledWith(
      "exp-1",
      "user-2",
      "admin",
    );
  });

  it("should skip transfer when target is already admin", async () => {
    userRepository.findOne.mockResolvedValue(success(mockUser));
    userRepository.findByEmail.mockResolvedValue(success(mockTarget));
    userRepository.getExperimentsWhereOnlyAdmin.mockResolvedValue(
      success([{ id: "exp-1", name: "Test", status: "active" }]),
    );
    experimentMemberRepository.getMemberRole.mockResolvedValue(success("admin"));

    const result = await useCase.execute("user-1", "colleague@example.com");

    assertSuccess(result);
    expect(result.value.transferred).toBe(1);
    expect(experimentMemberRepository.addMembers).not.toHaveBeenCalled();
    expect(experimentMemberRepository.updateMemberRole).not.toHaveBeenCalled();
  });

  it("should handle multiple blocking experiments", async () => {
    userRepository.findOne.mockResolvedValue(success(mockUser));
    userRepository.findByEmail.mockResolvedValue(success(mockTarget));
    userRepository.getExperimentsWhereOnlyAdmin.mockResolvedValue(
      success([
        { id: "exp-1", name: "Active", status: "active" },
        { id: "exp-2", name: "Archived", status: "archived" },
      ]),
    );
    experimentMemberRepository.getMemberRole.mockResolvedValue(success(null));
    experimentMemberRepository.addMembers.mockResolvedValue(success([]));

    const result = await useCase.execute("user-1", "colleague@example.com");

    assertSuccess(result);
    expect(result.value.transferred).toBe(2);
    expect(experimentMemberRepository.addMembers).toHaveBeenCalledTimes(2);
  });

  it("should return 0 transferred when no blocking experiments", async () => {
    userRepository.findOne.mockResolvedValue(success(mockUser));
    userRepository.findByEmail.mockResolvedValue(success(mockTarget));
    userRepository.getExperimentsWhereOnlyAdmin.mockResolvedValue(success([]));

    const result = await useCase.execute("user-1", "colleague@example.com");

    assertSuccess(result);
    expect(result.value.transferred).toBe(0);
  });

  it("should return NOT_FOUND when current user does not exist", async () => {
    userRepository.findOne.mockResolvedValue(success(null));

    const result = await useCase.execute("user-1", "colleague@example.com");

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return NOT_FOUND when target email does not exist", async () => {
    userRepository.findOne.mockResolvedValue(success(mockUser));
    userRepository.findByEmail.mockResolvedValue(success(null));

    const result = await useCase.execute("user-1", "nobody@example.com");

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain("nobody@example.com");
  });

  it("should return BAD_REQUEST when transferring to self", async () => {
    userRepository.findOne.mockResolvedValue(success(mockUser));
    userRepository.findByEmail.mockResolvedValue(success(mockUser)); // same user

    const result = await useCase.execute("user-1", "owner@example.com");

    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(result.error.message).toContain("yourself");
  });

  it("should continue on getMemberRole failure and not count it as transferred", async () => {
    userRepository.findOne.mockResolvedValue(success(mockUser));
    userRepository.findByEmail.mockResolvedValue(success(mockTarget));
    userRepository.getExperimentsWhereOnlyAdmin.mockResolvedValue(
      success([{ id: "exp-1", name: "Test", status: "active" }]),
    );
    experimentMemberRepository.getMemberRole.mockResolvedValue(
      failure(AppError.internal("DB error")),
    );

    const result = await useCase.execute("user-1", "colleague@example.com");

    assertSuccess(result);
    expect(result.value.transferred).toBe(0);
  });

  it("should continue on addMembers failure and not count it as transferred", async () => {
    userRepository.findOne.mockResolvedValue(success(mockUser));
    userRepository.findByEmail.mockResolvedValue(success(mockTarget));
    userRepository.getExperimentsWhereOnlyAdmin.mockResolvedValue(
      success([{ id: "exp-1", name: "Test", status: "active" }]),
    );
    experimentMemberRepository.getMemberRole.mockResolvedValue(success(null));
    experimentMemberRepository.addMembers.mockResolvedValue(
      failure(AppError.internal("Insert failed")),
    );

    const result = await useCase.execute("user-1", "colleague@example.com");

    assertSuccess(result);
    expect(result.value.transferred).toBe(0);
  });

  it("should continue on updateMemberRole failure and not count it as transferred", async () => {
    userRepository.findOne.mockResolvedValue(success(mockUser));
    userRepository.findByEmail.mockResolvedValue(success(mockTarget));
    userRepository.getExperimentsWhereOnlyAdmin.mockResolvedValue(
      success([{ id: "exp-1", name: "Test", status: "active" }]),
    );
    experimentMemberRepository.getMemberRole.mockResolvedValue(success("member"));
    experimentMemberRepository.updateMemberRole.mockResolvedValue(
      failure(AppError.internal("Update failed")),
    );

    const result = await useCase.execute("user-1", "colleague@example.com");

    assertSuccess(result);
    expect(result.value.transferred).toBe(0);
  });
});
