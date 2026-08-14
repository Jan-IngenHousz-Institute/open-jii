import { createTestQueryClient, renderHook } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useCreateOrganization } from "./useCreateOrganization";

const create = () => vi.mocked(authClient.organization.create);

describe("useCreateOrganization", () => {
  /**
   * The load-bearing field of this whole mutation. In Better Auth 1.6.23
   * `keepCurrentActiveOrganization` is part of the request *body*, not a plugin
   * option, so nothing server-side can set it — and without it the plugin points the
   * session's active organization at the new row. That is state this product has no
   * concept of and no surface for, and it would then silently steer every Better Auth
   * call that defaults to "the active organization" for the rest of the session.
   *
   * Nothing else in the suite would notice its removal, which is why it is asserted
   * here rather than left to the create form's own tests.
   */
  it("keeps the session's active organization out of it", async () => {
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useCreateOrganization(), { queryClient });
    await result.current.mutateAsync({
      name: "Greenhouse Lab",
      slug: "greenhouse-lab",
      visibility: "private",
    });

    expect(create()).toHaveBeenCalledWith(
      expect.objectContaining({ keepCurrentActiveOrganization: true }),
    );
  });

  it("omits the optional profile fields it was not given", async () => {
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useCreateOrganization(), { queryClient });
    await result.current.mutateAsync({
      name: "Greenhouse Lab",
      slug: "greenhouse-lab",
      description: "",
      website: "",
      location: "",
      visibility: "private",
    });

    // Empty is absent, not a set-but-blank profile field: the columns are nullable
    // and an empty string would render as a value somebody chose. Visibility is not
    // among them: it is always chosen, so it is always sent.
    expect(create()).toHaveBeenCalledWith({
      name: "Greenhouse Lab",
      slug: "greenhouse-lab",
      keepCurrentActiveOrganization: true,
      visibility: "private",
    });
  });

  it("passes the profile fields it was given", async () => {
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useCreateOrganization(), { queryClient });
    await result.current.mutateAsync({
      name: "Greenhouse Lab",
      slug: "greenhouse-lab",
      type: "university",
      description: "We study leaves",
      website: "https://openjii.org/",
      location: "Wageningen",
      visibility: "public",
    });

    expect(create()).toHaveBeenCalledWith({
      name: "Greenhouse Lab",
      slug: "greenhouse-lab",
      keepCurrentActiveOrganization: true,
      type: "university",
      description: "We study leaves",
      website: "https://openjii.org/",
      location: "Wageningen",
      visibility: "public",
    });
  });
});
