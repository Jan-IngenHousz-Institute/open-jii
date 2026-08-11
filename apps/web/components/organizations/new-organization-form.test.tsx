import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authClient, useSession } from "@repo/auth/client";

import { NewOrganizationForm } from "./new-organization-form";

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

const create = () => vi.mocked(authClient.organization.create);

/**
 * The website field is strict, matching the transfer-request form's URL field: a full
 * `http(s)://…` URL or nothing. A bare host is refused rather than silently upgraded,
 * which is also what lets this form drop `noValidate` — the browser's own `type="url"`
 * check and this one now agree instead of disagreeing about the same value.
 */
describe("<NewOrganizationForm /> website submission", () => {
  afterEach(() => {
    mockSession(null);
    create().mockResolvedValue({ data: null, error: null });
  });

  async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("organizations.fields.name"), "Greenhouse Lab");
  }

  it("refuses a bare host, with the error rendered and nothing sent", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });

    render(<NewOrganizationForm />);

    await fillRequired(user);
    await user.type(screen.getByLabelText("organizations.fields.website"), "openjii.org");

    expect(screen.getByText("organizations.errors.website")).toBeVisible();
    expect(screen.getByRole("button", { name: "organizations.createAction" })).toBeDisabled();
    expect(create()).not.toHaveBeenCalled();
  });

  it("submits a full URL exactly as typed", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    create().mockResolvedValue({ data: { id: "org-1" }, error: null });

    render(<NewOrganizationForm />);

    await fillRequired(user);
    await user.type(
      screen.getByLabelText("organizations.fields.website"),
      "https://openjii.org/about",
    );
    await user.click(screen.getByRole("button", { name: "organizations.createAction" }));

    await waitFor(() => {
      expect(create()).toHaveBeenCalled();
    });
    // Stored verbatim: no trailing slash added, no scheme rewritten.
    expect(create().mock.calls[0]?.[0]).toMatchObject({ website: "https://openjii.org/about" });
  });

  it("submits with no website at all when the field is left empty", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    create().mockResolvedValue({ data: { id: "org-1" }, error: null });

    render(<NewOrganizationForm />);

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "organizations.createAction" }));

    await waitFor(() => {
      expect(create()).toHaveBeenCalled();
    });
    // Empty is absent, not a set-but-blank field.
    expect(create().mock.calls[0]?.[0]).not.toHaveProperty("website");
  });
});
