import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { authClient, useSession } from "@repo/auth/client";
import deCommon from "@repo/i18n/locales/de-DE/common.json";
import enCommon from "@repo/i18n/locales/en-US/common.json";
import nlCommon from "@repo/i18n/locales/nl-NL/common.json";
import { toast } from "@repo/ui/hooks/use-toast";

import { NewOrganizationForm } from "../new-organization";
import type { NewOrganizationFormValues } from "../steps/form-step";

/**
 * The wizard is stubbed so a submit can be provoked with an exact set of values, which
 * is what makes the payload assertions below possible — but a stub also drops the
 * resolver, so it cannot prove a field survives the trip from its card to the wire.
 * That is what `new-organization-flow.test.tsx` walks the real wizard for; here the
 * subject is what happens *after* Review's button: one create, then the people, then
 * the destination.
 */
const { submitValues } = vi.hoisted(() => ({
  submitValues: { current: null as NewOrganizationFormValues | null },
}));

vi.mock("@repo/ui/components/wizard-form", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    WizardForm: ({
      onSubmit,
      isSubmitting,
    }: {
      onSubmit: (data: NewOrganizationFormValues) => void;
      isSubmitting?: boolean;
    }) => (
      <form
        aria-label="wizard form"
        onSubmit={(e) => {
          e.preventDefault();
          if (submitValues.current) onSubmit(submitValues.current);
        }}
      >
        {/* Stands in for any field of the real wizard: what marks the form dirty is
            typing reaching the wrapper the root puts around it. */}
        <input aria-label="wizard input" />
        <button type="submit" disabled={isSubmitting}>
          Submit
        </button>
      </form>
    ),
  };
});

const create = () => vi.mocked(authClient.organization.create);
const inviteMember = () => vi.mocked(authClient.organization.inviteMember);

const ALICE_ID = "11111111-1111-4111-8111-111111111111";

function values(overrides: Partial<NewOrganizationFormValues> = {}): NewOrganizationFormValues {
  return {
    name: "Greenhouse Lab",
    slug: "greenhouse-lab",
    type: "university",
    description: "We grow things.",
    website: "https://openjii.org/about",
    location: "Wageningen",
    people: [],
    ...overrides,
  };
}

function mountAddMember(status?: number) {
  return server.mount(contract.organizations.addOrganizationMember, {
    ...(status === undefined ? {} : { status }),
    body: status === undefined ? { userId: ALICE_ID, role: "member" } : { message: "nope" },
  });
}

beforeEach(() => {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id: "current-user-id" } },
    isPending: false,
  } as ReturnType<typeof useSession>);
  create().mockResolvedValue({ data: { id: "org-1" }, error: null });
  inviteMember().mockResolvedValue({ data: null, error: null });
  submitValues.current = values();
});

async function submit() {
  const user = userEvent.setup();
  render(<NewOrganizationForm />);
  await user.click(screen.getByRole("button", { name: "Submit" }));
}

describe("<NewOrganizationForm /> submit", () => {
  it("creates the organization from the collected values, with empty fields absent", async () => {
    submitValues.current = values({ type: "none", description: "", website: "", location: "" });

    await submit();

    await waitFor(() => {
      expect(create()).toHaveBeenCalledTimes(1);
    });
    // No type and no profile fields: an unset optional is omitted rather than sent as
    // "", which is what keeps it absent instead of set-but-blank. Visibility is never
    // sent — a new organization is private by definition.
    expect(create().mock.calls[0]?.[0]).toEqual({
      name: "Greenhouse Lab",
      slug: "greenhouse-lab",
      keepCurrentActiveOrganization: true,
    });
  });

  it("sends every field it was given", async () => {
    await submit();

    await waitFor(() => {
      expect(create()).toHaveBeenCalledTimes(1);
    });
    expect(create().mock.calls[0]?.[0]).toEqual({
      name: "Greenhouse Lab",
      slug: "greenhouse-lab",
      keepCurrentActiveOrganization: true,
      type: "university",
      description: "We grow things.",
      website: "https://openjii.org/about",
      location: "Wageningen",
    });
  });

  it("adds a registered person and invites an address, then navigates", async () => {
    const addSpy = mountAddMember();
    submitValues.current = values({
      people: [
        { kind: "user", userId: ALICE_ID, displayName: "Alice Tester", role: "admin" },
        { kind: "email", email: "newcomer@example.org", role: "owner" },
      ],
    });

    await submit();

    // The real outgoing request, not merely "the mutation ran": everybody collected
    // joins as a member, and the organization is the one that was just created.
    await waitFor(() => {
      expect(addSpy.callCount).toBe(1);
    });
    // The role picked per person, not a default the wizard quietly substitutes.
    expect(addSpy.body).toEqual({ userId: ALICE_ID, role: "admin" });
    expect(addSpy.params.id).toBe("org-1");

    await waitFor(() => {
      expect(inviteMember()).toHaveBeenCalledWith({
        organizationId: "org-1",
        email: "newcomer@example.org",
        role: "owner",
      });
    });

    await waitFor(() => {
      expect(vi.mocked(useRouter)().push).toHaveBeenCalledWith(
        "/en-US/platform/organizations/org-1",
      );
    });
    expect(toast).toHaveBeenCalledWith({ description: "organizations.create.created" });
  });

  it("names whoever could not be added, and still goes to the organization", async () => {
    mountAddMember(500);
    inviteMember().mockResolvedValue({
      data: null,
      error: { message: "Invitation refused", code: "FORBIDDEN", status: 403 },
    });
    submitValues.current = values({
      people: [
        { kind: "user", userId: ALICE_ID, displayName: "Alice Tester", role: "member" },
        { kind: "email", email: "newcomer@example.org", role: "member" },
      ],
    });

    await submit();

    // Partial success is not total failure: the organization exists and is owned, so the
    // failures are reported and the destination is unchanged.
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: "organizations.create.people.failed",
        variant: "destructive",
      });
    });
    expect(toast).toHaveBeenCalledWith({ description: "organizations.create.created" });
    await waitFor(() => {
      expect(vi.mocked(useRouter)().push).toHaveBeenCalledWith(
        "/en-US/platform/organizations/org-1",
      );
    });
  });

  it("keeps the wizard and reports the server's own refusal when the create fails", async () => {
    create().mockResolvedValue({
      data: null,
      error: { message: "Organization slug is taken", code: "SLUG_IS_TAKEN", status: 400 },
    });
    const addSpy = mountAddMember();
    submitValues.current = values({
      people: [{ kind: "user", userId: ALICE_ID, displayName: "Alice Tester", role: "member" }],
    });

    await submit();

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: "Organization slug is taken",
        variant: "destructive",
      });
    });
    // Nobody is added to an organization that was never created, and nowhere to go.
    expect(addSpy.called).toBe(false);
    expect(vi.mocked(useRouter)().push).not.toHaveBeenCalled();
  });
});

/**
 * Leaving mid-wizard, which is the same guard the protocol wizard carries: a click on an
 * internal link is intercepted while there is unsaved work, and the wizard's own redirect
 * after a successful create is not.
 */
describe("<NewOrganizationForm /> unsaved changes", () => {
  /**
   * A sibling link, standing in for the sidebar entries that surround the wizard. The
   * bubble-phase `preventDefault` only stops jsdom from attempting a real navigation it
   * has not implemented; the guard listens in the capture phase, so it still sees every
   * click first and the assertions below are unaffected.
   */
  function renderWithLink() {
    return render(
      <>
        <a
          href="http://localhost:3000/en-US/platform/experiments"
          onClick={(e) => e.preventDefault()}
        >
          Experiments
        </a>
        <NewOrganizationForm />
      </>,
    );
  }

  it("does not interfere before anything has been entered", async () => {
    const user = userEvent.setup();
    renderWithLink();

    await user.click(screen.getByRole("link", { name: "Experiments" }));

    // An untouched wizard has nothing to lose, so the link behaves like a link.
    expect(screen.queryByText("organizations.create.unsavedChangesTitle")).not.toBeInTheDocument();
  });

  it("asks before leaving once there is work to lose, and stays put when told to", async () => {
    const user = userEvent.setup();
    renderWithLink();

    await user.type(screen.getByLabelText("wizard input"), "Greenhouse Lab");
    await user.click(screen.getByRole("link", { name: "Experiments" }));

    expect(await screen.findByText("organizations.create.unsavedChangesTitle")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "organizations.create.unsavedStay" }));

    expect(vi.mocked(useRouter)().push).not.toHaveBeenCalled();
  });

  it("goes where the link pointed once leaving is confirmed", async () => {
    const user = userEvent.setup();
    renderWithLink();

    await user.type(screen.getByLabelText("wizard input"), "Greenhouse Lab");
    await user.click(screen.getByRole("link", { name: "Experiments" }));
    await user.click(
      await screen.findByRole("button", { name: "organizations.create.unsavedLeave" }),
    );

    // The route, pushed rather than assigned — the protocol wizard's behaviour.
    expect(vi.mocked(useRouter)().push).toHaveBeenCalledWith("/en-US/platform/experiments");
  });

  it("does not ask on its own redirect after a successful create", async () => {
    const user = userEvent.setup();
    renderWithLink();

    // Dirty first, so the guard is armed at the moment the wizard navigates itself.
    await user.type(screen.getByLabelText("wizard input"), "Greenhouse Lab");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(vi.mocked(useRouter)().push).toHaveBeenCalledWith(
        "/en-US/platform/organizations/org-1",
      );
    });
    // Creating the organization then being taken to it is the happy path; a confirm
    // dialog there would be the bug this case exists to catch.
    expect(screen.queryByText("organizations.create.unsavedChangesTitle")).not.toBeInTheDocument();
  });
});

/**
 * The failure toast is only useful if it names the people: the `t` stub in these tests
 * returns the key, so the interpolation is asserted against the bundles instead.
 */
describe("the partial-failure message", () => {
  it.each([
    ["en-US", enCommon],
    ["de-DE", deCommon],
    ["nl-NL", nlCommon],
  ])("%s names the people it could not add", (_locale, bundle) => {
    expect(bundle.organizations.create.people.failed).toContain("{{names}}");
  });
});
