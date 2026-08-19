import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
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
const invite = () => vi.mocked(authClient.organization.inviteMember);
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

    // Review: what is about to be created, including the untouched privacy default.
    expect(await screen.findByText("organizations.create.reviewHeading")).toBeInTheDocument();
    expect(screen.getByText("Greenhouse Lab")).toBeInTheDocument();
    expect(screen.getByText("greenhouse-lab")).toBeInTheDocument();
    expect(screen.getByText("We grow things.")).toBeInTheDocument();
    expect(screen.getByText("https://openjii.org/about")).toBeInTheDocument();
    expect(screen.getByText("Wageningen")).toBeInTheDocument();
    expect(screen.getByText("organizations.create.privateNote")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "organizations.createAction" }));

    await waitFor(() => {
      expect(create()).toHaveBeenCalledTimes(1);
    });
    // Trimmed, and nothing invented: the visibility nobody touched, and no type.
    expect(create().mock.calls[0]?.[0]).toEqual({
      name: "Greenhouse Lab",
      slug: "greenhouse-lab",
      keepCurrentActiveOrganization: true,
      description: "We grow things.",
      website: "https://openjii.org/about",
      location: "Wageningen",
      visibility: "private",
    });
  });

  // Private is also the server's fallback, so only `public` proves the control is wired.
  it("publishes the organization when the profile step's public option is chosen", async () => {
    const user = userEvent.setup();
    // Scoped to this render: `isolate` is off, so a document-wide role query leaks.
    const { container } = render(<NewOrganizationForm />);

    await user.type(screen.getByLabelText("organizations.fields.name"), "Greenhouse Lab");
    await user.click(next());

    expect(await screen.findByText("organizations.create.profileDescription")).toBeInTheDocument();
    // Private until somebody says otherwise, and the wizard opens on it.
    const [privateOption, publicOption] = within(container).getAllByRole("radio");
    expect(privateOption).toHaveAttribute("aria-checked", "true");
    expect(publicOption).toHaveAttribute("aria-checked", "false");

    await user.click(publicOption);
    expect(publicOption).toHaveAttribute("aria-checked", "true");
    expect(privateOption).toHaveAttribute("aria-checked", "false");

    await user.click(next());
    await user.click(await screen.findByRole("button", { name: "organizations.create.next" }));

    // Read back twice: the summary row, and the sentence above the create button.
    expect(await screen.findByText("organizations.create.reviewHeading")).toBeInTheDocument();
    expect(screen.getByText("organizations.visibility.publicLabel")).toBeInTheDocument();
    expect(screen.getByText("organizations.create.publicNote")).toBeInTheDocument();
    expect(screen.queryByText("organizations.create.privateNote")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "organizations.createAction" }));

    await waitFor(() => {
      expect(create()).toHaveBeenCalledTimes(1);
    });
    expect(create().mock.calls[0]?.[0]).toMatchObject({ visibility: "public" });
  });

  it("sends the role a collected person was changed to, not the one they were added on", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({
          userId: "u-1",
          firstName: "Lin",
          lastName: "Zhao",
          email: "lin@uni.edu",
        }),
      ],
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
      expect(invite()).toHaveBeenCalledTimes(1);
    });
    expect(invite()).toHaveBeenCalledWith({
      organizationId: "org-1",
      email: "lin@uni.edu",
      role: "admin",
    });
  });

  it("refuses a name longer than the column will hold", async () => {
    const user = userEvent.setup();
    render(<NewOrganizationForm />);

    // `paste`: 256 keystrokes through the seeded-slug handler is slow.
    await user.click(screen.getByLabelText("organizations.fields.name"));
    await user.paste("a".repeat(256));

    // Caught here rather than at the insert, three steps from the field that caused it.
    expect(await screen.findByText("organizations.errors.nameTooLong")).toBeInTheDocument();
    await user.click(next());
    expect(screen.getByLabelText("organizations.fields.name")).toBeInTheDocument();
    expect(screen.getByText("organizations.errors.nameTooLong")).toBeInTheDocument();
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
