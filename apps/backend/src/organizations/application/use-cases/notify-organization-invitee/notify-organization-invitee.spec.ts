import { Logger } from "@nestjs/common";

import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import type { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import type { UserRepository } from "../../../../users/core/repositories/user.repository";
import type { OrganizationRepository } from "../../../core/repositories/organization.repository";
import { NotifyOrganizationInviteeUseCase } from "./notify-organization-invitee";

const INVITATION = {
  id: "inv-1",
  email: "Invitee@Example.com",
  role: "admin",
  organizationId: "org-1",
  inviterId: "inviter-1",
};

/** Defaults to an invitee with an account, and the organization they were invited to. */
function useCaseWith(overrides: { invitee?: unknown; organization?: unknown } = {}) {
  const findIdByEmail = vi.fn().mockResolvedValue(overrides.invitee ?? success("invitee-1"));
  const findName = vi
    .fn()
    .mockResolvedValue(overrides.organization ?? success("Photosynthesis Lab"));
  const dispatch = vi.fn().mockResolvedValue(success({ created: 1, emailed: 1 }));

  const useCase = new NotifyOrganizationInviteeUseCase(
    { findIdByEmail } as unknown as UserRepository,
    { findName } as unknown as OrganizationRepository,
    { dispatch } as unknown as NotificationDispatchService,
  );

  return { useCase, findIdByEmail, findName, dispatch };
}

describe("NotifyOrganizationInviteeUseCase", () => {
  it("dispatches one notification to an invitee who has an account", async () => {
    const { useCase, findIdByEmail, dispatch } = useCaseWith();

    assertSuccess(await useCase.execute(INVITATION));

    expect(findIdByEmail).toHaveBeenCalledExactlyOnceWith("Invitee@Example.com");
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({
      type: "organization_invitation_received",
      recipientIds: ["invitee-1"],
      actorId: "inviter-1",
      resource: { type: "organization", id: "org-1" },
      params: { organizationName: "Photosynthesis Lab", role: "admin" },
      // The invitation id, so the sign-in catch-up cannot tell them a second time.
      dedupeKey: "organization_invitation_received:inv-1",
    });
  });

  it("tells nobody when the invitee has no account yet", async () => {
    // Better Auth has already emailed them; dispatch addresses user ids, and there
    // is no id to address. They hear about it when they first sign in.
    const { useCase, dispatch, findName } = useCaseWith({
      invitee: success(null),
    });

    assertSuccess(await useCase.execute(INVITATION));

    expect(findName).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("tells nobody when the organization cannot be read", async () => {
    const { useCase, dispatch } = useCaseWith({ organization: success(null) });

    assertSuccess(await useCase.execute(INVITATION));

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("logs and gives up when the invitee lookup fails", async () => {
    const { useCase, dispatch } = useCaseWith({
      invitee: failure(AppError.internal("connection terminated")),
    });
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    assertFailure(await useCase.execute(INVITATION));

    expect(dispatch).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "notify-invitee", invitationId: "inv-1" }),
    );
  });

  it("logs and gives up when the organization read fails", async () => {
    const { useCase, dispatch } = useCaseWith({
      organization: failure(AppError.internal("connection terminated")),
    });
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    assertFailure(await useCase.execute(INVITATION));

    expect(dispatch).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "notify-invitee", invitationId: "inv-1" }),
    );
  });

  it("logs and returns when the dispatch fails, so the invitation still stands", async () => {
    const { useCase, dispatch } = useCaseWith();
    dispatch.mockResolvedValue(failure(AppError.internal("notifications unavailable")));
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    assertFailure(await useCase.execute(INVITATION));

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "notify-invitee", invitationId: "inv-1" }),
    );
  });
});
