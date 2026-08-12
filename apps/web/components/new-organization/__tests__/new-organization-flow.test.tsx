import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { authClient, useSession } from "@repo/auth/client";

import { NewOrganizationForm } from "../new-organization";

/**
 * The wizard driven for real, step by step, with the resolver in place.
 *
 * Deliberately not stubbing `WizardForm`: a stub supplies its own values, so it can
 * only prove what the submit handler does with them. Everything asserted here is the
 * part a stub is blind to — that each field reaches the create, that a step refuses to
 * advance while one of its rules is broken, and that the slug the server has already
 * refused cannot be carried forward.
 */
vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: <T,>(value: T): [T, boolean] => [value, true],
}));

const create = () => vi.mocked(authClient.organization.create);
const checkSlug = () => vi.mocked(authClient.organization.checkSlug);

beforeEach(() => {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id: "current-user-id" } },
    isPending: false,
  } as ReturnType<typeof useSession>);
  create().mockResolvedValue({ data: { id: "org-1" }, error: null });
  checkSlug().mockResolvedValue({ data: { status: true }, error: null });
});

const next = () => screen.getByRole("button", { name: "organizations.create.next" });

describe("the create-organization wizard", () => {
  it("carries every field it collected into the create", async () => {
    const user = userEvent.setup();
    render(<NewOrganizationForm />);

    // Identity: the slug follows the name until it is edited by hand.
    await user.type(screen.getByLabelText("organizations.fields.name"), "Greenhouse Lab");
    expect(screen.getByLabelText("organizations.fields.slug")).toHaveValue("greenhouse-lab");
    // The availability answer is shown as it lands, not only when it refuses.
    expect(await screen.findByLabelText("organizations.slug.available")).toBeInTheDocument();

    await user.click(next());

    // Profile: optional, but the URL rule is strict.
    expect(await screen.findByText("organizations.create.profileDescription")).toBeInTheDocument();
    await user.type(
      screen.getByLabelText("organizations.fields.description"),
      "  We grow things.  ",
    );
    await user.type(screen.getByLabelText("organizations.fields.website"), "openjii.org");
    expect(await screen.findByText("organizations.errors.website")).toBeInTheDocument();

    await user.click(next());
    // A bare host does not advance the step.
    expect(screen.getByLabelText("organizations.fields.website")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("organizations.fields.website"));
    await user.type(
      screen.getByLabelText("organizations.fields.website"),
      "https://openjii.org/about",
    );
    await user.type(screen.getByLabelText("organizations.fields.location"), "Wageningen");
    await user.click(next());

    // People: nobody is a valid answer, and this is where teams are explained away.
    expect(await screen.findByText("organizations.create.people.empty")).toBeInTheDocument();
    expect(screen.getByText("organizations.create.people.teamsNote")).toBeInTheDocument();
    await user.click(next());

    // Review: what is about to be created, including that it will be private.
    expect(await screen.findByText("organizations.create.reviewHeading")).toBeInTheDocument();
    expect(screen.getByText("Greenhouse Lab")).toBeInTheDocument();
    expect(screen.getByText("greenhouse-lab")).toBeInTheDocument();
    expect(screen.getByText("We grow things.")).toBeInTheDocument();
    expect(screen.getByText("https://openjii.org/about")).toBeInTheDocument();
    expect(screen.getByText("Wageningen")).toBeInTheDocument();
    expect(screen.getByText("organizations.create.privacyNote")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "organizations.createAction" }));

    await waitFor(() => {
      expect(create()).toHaveBeenCalledTimes(1);
    });
    // Trimmed, and nothing invented: no visibility, and the untouched type is absent.
    expect(create().mock.calls[0]?.[0]).toEqual({
      name: "Greenhouse Lab",
      slug: "greenhouse-lab",
      keepCurrentActiveOrganization: true,
      description: "We grow things.",
      website: "https://openjii.org/about",
      location: "Wageningen",
    });
  });

  it("sends the role a collected person was changed to, not the one they were added on", async () => {
    const user = userEvent.setup();
    const addSpy = server.mount(contract.organizations.addOrganizationMember, { body: {} });
    server.mount(contract.users.searchUsers, {
      body: [createUserProfile({ userId: "u-1", firstName: "Lin", lastName: "Zhao" })],
    });
    render(<NewOrganizationForm />);

    await user.type(screen.getByLabelText("organizations.fields.name"), "Greenhouse Lab");
    await user.click(next());
    await user.click(await screen.findByRole("button", { name: "organizations.create.next" }));

    // Collected on the default role…
    await user.type(await screen.findByLabelText("organizations.invite.searchLabel"), "lin");
    await user.click(await screen.findByText("Lin Zhao"));
    await user.click(screen.getByRole("button", { name: "common.add" }));

    // …then corrected in place, which is the value the write has to carry.
    await user.click(screen.getByRole("combobox", { name: /roleForLabel/u }));
    await user.click(screen.getByRole("option", { name: "organizations.roles.admin" }));

    await user.click(next());
    expect(await screen.findByText("organizations.create.reviewHeading")).toBeInTheDocument();
    // Review reads the corrected role too, so the two cannot disagree about it.
    expect(screen.getByText("organizations.roles.admin")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "organizations.createAction" }));

    await waitFor(() => {
      expect(addSpy.callCount).toBe(1);
    });
    expect(addSpy.body).toEqual({ userId: "u-1", role: "admin" });
    expect(addSpy.params.id).toBe("org-1");
  });

  it("refuses to leave the first step on a name-less form", async () => {
    const user = userEvent.setup();
    render(<NewOrganizationForm />);

    await user.click(next());

    expect(await screen.findByText("organizations.errors.nameRequired")).toBeInTheDocument();
    expect(screen.getByText("organizations.errors.slug.required")).toBeInTheDocument();
    expect(screen.getByLabelText("organizations.fields.name")).toBeInTheDocument();
  });

  it("refuses a slug in the reserved personal namespace before asking the server", async () => {
    const user = userEvent.setup();
    render(<NewOrganizationForm />);

    await user.type(screen.getByLabelText("organizations.fields.name"), "Greenhouse Lab");
    await user.clear(screen.getByLabelText("organizations.fields.slug"));
    await user.type(screen.getByLabelText("organizations.fields.slug"), "personal-greenhouse");

    expect(await screen.findByText("organizations.errors.slug.reserved")).toBeInTheDocument();
    // The availability endpoint answers only "is it taken", so it is never asked about a
    // slug this side already refuses.
    expect(checkSlug()).not.toHaveBeenCalledWith({ slug: "personal-greenhouse" });

    await user.click(next());
    expect(screen.getByText("organizations.errors.slug.reserved")).toBeInTheDocument();
  });

  it("does not carry a taken slug past the first step", async () => {
    const user = userEvent.setup();
    // Better Auth reports a taken slug by refusing the check, which is the negative
    // answer rather than a failure.
    checkSlug().mockResolvedValue({
      data: null,
      error: { message: "slug is taken", code: "SLUG_IS_TAKEN", status: 400 },
    });
    render(<NewOrganizationForm />);

    await user.type(screen.getByLabelText("organizations.fields.name"), "Greenhouse Lab");

    expect(await screen.findByText("organizations.errors.slug.taken")).toBeInTheDocument();

    await user.click(next());
    expect(screen.getByLabelText("organizations.fields.slug")).toBeInTheDocument();
    expect(screen.getByText("organizations.errors.slug.taken")).toBeInTheDocument();
  });
});
