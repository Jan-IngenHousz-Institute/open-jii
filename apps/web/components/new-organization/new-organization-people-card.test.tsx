import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderWithForm, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { NewOrganizationPeopleCard } from "./new-organization-people-card";
import type { NewOrganizationFormValues } from "./steps/form-step";
import { NO_TYPE } from "./steps/form-step";

vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: <T,>(value: T): [T, boolean] => [value, true],
}));

function renderPeopleCard(people: NewOrganizationFormValues["people"] = []) {
  return renderWithForm<NewOrganizationFormValues>(
    (form) => <NewOrganizationPeopleCard form={form} />,
    {
      useFormProps: {
        defaultValues: {
          name: "Greenhouse Lab",
          slug: "greenhouse-lab",
          type: NO_TYPE,
          description: "",
          website: "",
          location: "",
          people,
        },
      },
    },
  );
}

const search = () => screen.getByLabelText("organizations.invite.searchLabel");
/** The role the next person will be added on. */
const roleSelect = () => screen.getByRole("combobox", { name: /invite\.roleLabel/u });
/** A collected person's own role control, the roster's `roleForLabel` one. */
const rowRoleSelects = () => screen.getAllByRole("combobox", { name: /roleForLabel/u });

async function chooseRole(user: ReturnType<typeof userEvent.setup>, role: string) {
  await user.click(roleSelect());
  await user.click(screen.getByRole("option", { name: `organizations.roles.${role}` }));
}

describe("<NewOrganizationPeopleCard />", () => {
  it("collects a registered person with the chosen role instead of adding them", async () => {
    const user = userEvent.setup();
    const addSpy = server.mount(contract.organizations.addOrganizationMember, { body: {} });
    server.mount(contract.users.searchUsers, {
      body: [createUserProfile({ userId: "u-1", firstName: "Lin", lastName: "Zhao" })],
    });

    const { form } = renderPeopleCard();

    await user.type(search(), "lin");
    await user.click(await screen.findByText("Lin Zhao"));
    await chooseRole(user, "admin");
    await user.click(screen.getByRole("button", { name: "common.add" }));

    expect(form.getValues("people")).toEqual([
      { kind: "user", userId: "u-1", displayName: "Lin Zhao", role: "admin" },
    ]);
    // Nothing exists to add them to yet: the wizard spends these on submit.
    expect(addSpy.called).toBe(false);
    expect(rowRoleSelects()[0]).toHaveTextContent("organizations.roles.admin");
  });

  it("changes a collected person's role in place, rather than making them be re-added", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, { body: [] });

    const { form } = renderPeopleCard([
      { kind: "user", userId: "u-1", displayName: "Lin Zhao", role: "member" },
      { kind: "email", email: "newcomer@example.org", role: "member" },
    ]);

    // The roster's control on the roster's terms: one select per person, and only that
    // person's role moves.
    await user.click(rowRoleSelects()[0]);
    await user.click(screen.getByRole("option", { name: "organizations.roles.owner" }));

    expect(form.getValues("people")).toEqual([
      { kind: "user", userId: "u-1", displayName: "Lin Zhao", role: "owner" },
      { kind: "email", email: "newcomer@example.org", role: "member" },
    ]);

    // An invitation's role is editable too — it is the role the invitation carries.
    await user.click(rowRoleSelects()[1]);
    await user.click(screen.getByRole("option", { name: "organizations.roles.admin" }));

    expect(form.getValues("people")).toEqual([
      { kind: "user", userId: "u-1", displayName: "Lin Zhao", role: "owner" },
      { kind: "email", email: "newcomer@example.org", role: "admin" },
    ]);
  });

  it("offers every role, since whoever is creating the organization owns it", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, { body: [] });

    renderPeopleCard();

    await user.click(roleSelect());
    const options = screen.getByRole("listbox");

    for (const role of ["owner", "admin", "member"]) {
      expect(
        within(options).getByRole("option", { name: `organizations.roles.${role}` }),
      ).toBeVisible();
    }
  });

  it("returns to member after each add, so a role is never inherited by accident", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, {
      body: [createUserProfile({ userId: "u-1", firstName: "Lin", lastName: "Zhao" })],
    });

    renderPeopleCard();

    await user.type(search(), "lin");
    await user.click(await screen.findByText("Lin Zhao"));
    await chooseRole(user, "owner");
    await user.click(screen.getByRole("button", { name: "common.add" }));

    expect(roleSelect()).toHaveTextContent("organizations.roles.member");
  });

  it("collects an address no account answers to as an invitation", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, { body: [] });

    const { form } = renderPeopleCard();

    await user.type(search(), "newcomer@example.org");
    await user.click(await screen.findByText("organizations.invite.sendByEmail"));
    await user.click(screen.getByRole("button", { name: "common.add" }));

    expect(form.getValues("people")).toEqual([
      { kind: "email", email: "newcomer@example.org", role: "member" },
    ]);
    // The Mail icon is aria-hidden, so how they arrive is said in words as well.
    expect(screen.getByText("organizations.create.people.invitedByEmail")).toBeInTheDocument();
  });

  it("drops somebody already collected from the results, and explains their address", async () => {
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

    renderPeopleCard([{ kind: "user", userId: "u-1", displayName: "Lin Zhao", role: "member" }]);

    await user.type(search(), "lin");
    // Filtered out of the results, the same as the sharing picker.
    await waitFor(() =>
      expect(screen.getByText("organizations.invite.noMatches")).toBeInTheDocument(),
    );

    await user.clear(search());
    await user.type(search(), "lin@uni.edu");

    // Typing their full address is answered, in the wizard's own terms: "already a
    // member" would be a lie about an organization that does not exist.
    await waitFor(() =>
      expect(screen.getByText("organizations.create.people.alreadyAdded")).toBeInTheDocument(),
    );
    expect(screen.queryByText("organizations.invite.alreadyMember")).not.toBeInTheDocument();
    expect(screen.queryByText("organizations.invite.sendByEmail")).not.toBeInTheDocument();
  });

  it("drops somebody again before the organization is created", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, { body: [] });

    const { form } = renderPeopleCard([
      { kind: "user", userId: "u-1", displayName: "Lin Zhao", role: "admin" },
      { kind: "email", email: "newcomer@example.org", role: "member" },
    ]);

    await user.click(screen.getAllByRole("button", { name: "common.remove" })[0]);

    expect(form.getValues("people")).toEqual([
      { kind: "email", email: "newcomer@example.org", role: "member" },
    ]);
  });

  it("says where teams come from, since they cannot be made here", () => {
    server.mount(contract.users.searchUsers, { body: [] });

    renderPeopleCard();

    expect(screen.getByText("organizations.create.people.teamsNote")).toBeInTheDocument();
  });

  it("labels both regions, so neither the composer nor the list is unheaded", () => {
    server.mount(contract.users.searchUsers, { body: [] });

    renderPeopleCard();

    expect(
      screen.getByRole("heading", { name: "organizations.create.people.addTitle" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "organizations.create.people.listTitle" }),
    ).toBeInTheDocument();
    // The empty state belongs to the list, not to the gap between two controls, so the
    // heading is there whether or not anybody has been collected.
    expect(screen.getByText("organizations.create.people.empty")).toBeInTheDocument();
    expect(screen.queryByText("organizations.create.people.count")).not.toBeInTheDocument();
  });

  it("counts the people beside the list's heading once there are any", () => {
    server.mount(contract.users.searchUsers, { body: [] });

    renderPeopleCard([
      { kind: "user", userId: "u-1", displayName: "Lin Zhao", role: "member" },
      { kind: "email", email: "newcomer@example.org", role: "member" },
    ]);

    expect(screen.getByText("organizations.create.people.count")).toBeInTheDocument();
    expect(screen.queryByText("organizations.create.people.empty")).not.toBeInTheDocument();
  });
});
