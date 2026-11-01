import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderWithForm, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import type { CreateExperimentBody } from "@repo/api/domains/experiment/experiment.schema";
import { useSession } from "@repo/auth/client";

import {
  describeNewExperimentCandidate,
  NewExperimentMembersCard,
} from "./new-experiment-members-card";

// Override global session mock with a logged-in user
beforeEach(() => {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id: "current-user-id" } },
  } as ReturnType<typeof useSession>);
});

vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: <T,>(v: T): [T, boolean] => [v, true],
}));

type FormMember = NonNullable<CreateExperimentBody["members"]>[number];

function renderMembersCard(initialMembers: FormMember[] = []) {
  return renderWithForm<CreateExperimentBody>((form) => <NewExperimentMembersCard form={form} />, {
    useFormProps: {
      defaultValues: {
        name: "Test Experiment",
        visibility: "private",
        embargoUntil: "",
        status: "active",
        description: "",
        members: initialMembers,
      },
    },
  });
}

const users = [
  createUserProfile({ userId: "current-user-id", firstName: "Me" }),
  createUserProfile({
    userId: "user-1",
    firstName: "Alice",
    lastName: "Tester",
    avatarUrl: "https://example.com/alice.jpg",
  }),
  createUserProfile({ userId: "user-2", firstName: "Bob", lastName: "Tester" }),
];

describe("<NewExperimentMembersCard />", () => {
  it("renders title and description", () => {
    server.mount(contract.users.searchUsers, { body: [] });
    renderMembersCard([]);
    expect(screen.getByText("newExperiment.addCollaboratorsTitle")).toBeInTheDocument();
    expect(screen.getByText("newExperiment.addCollaboratorsDescription")).toBeInTheDocument();
    // The tier every initial collaborator lands on is stated up front.
    expect(screen.getByText("newExperiment.initialCollaboratorsTierNote")).toBeInTheDocument();
  });

  it("adds a member after selecting from popover and clicking Add", async () => {
    server.mount(contract.users.searchUsers, { body: users });
    renderMembersCard([]);

    const searchInput = screen.getByPlaceholderText("experiments.searchUsersPlaceholder");
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, "Alice");

    await waitFor(() => {
      expect(screen.getByText("Alice Tester")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Alice Tester"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "common.add" })).not.toBeDisabled();
    });

    await userEvent.click(screen.getByRole("button", { name: "common.add" }));

    await waitFor(() => {
      expect(screen.getByText("Alice Tester")).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "AT" })).toBeInTheDocument();
    });
  });

  it("adds and removes a named member whose email is redacted", async () => {
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({
          userId: "u-hidden",
          firstName: "Cora",
          lastName: "Admin",
          email: null,
        }),
      ],
    });
    renderMembersCard();
    await userEvent.type(screen.getByPlaceholderText("experiments.searchUsersPlaceholder"), "Cora");
    await waitFor(() => expect(screen.getByText("Cora Admin")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Cora Admin"));
    await userEvent.click(screen.getByRole("button", { name: "common.add" }));
    expect(screen.getByText("Cora Admin")).toBeInTheDocument();
    expect(screen.queryByText("null")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "common.remove" }));
    expect(screen.queryByText("Cora Admin")).not.toBeInTheDocument();
  });

  it("never offers the person creating the experiment", async () => {
    server.mount(contract.users.searchUsers, { body: users });
    renderMembersCard([]);

    await userEvent.type(screen.getByPlaceholderText("experiments.searchUsersPlaceholder"), "Te");

    await waitFor(() => expect(screen.getByText("Alice Tester")).toBeInTheDocument());
    expect(screen.queryByText("Me User")).not.toBeInTheDocument();
  });

  it("greys out somebody already added instead of hiding them", async () => {
    server.mount(contract.users.searchUsers, { body: users });
    renderMembersCard([{ userId: "user-1", firstName: "Alice", lastName: "Tester" }]);

    await userEvent.type(screen.getByPlaceholderText("experiments.searchUsersPlaceholder"), "Te");

    const row = await screen.findByRole("button", { name: /Alice Tester/u });
    expect(row).toBeDisabled();
    expect(within(row).getByText("newExperiment.alreadyAdded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bob Tester/u })).toBeEnabled();
  });

  it("labels a hidden exact match without showing the address or an invitation row", async () => {
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({
          userId: "u-cora",
          firstName: "Cora",
          lastName: "Admin",
          email: null,
          matchedEmail: true,
        }),
      ],
    });
    renderMembersCard();

    await userEvent.type(
      screen.getByPlaceholderText("experiments.searchUsersPlaceholder"),
      "cora@example.test",
    );

    await waitFor(() => expect(screen.getByText("common.emailMatched")).toBeVisible());
    expect(screen.queryByText("cora@example.test")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Cora Admin"));
    expect(screen.getByPlaceholderText("experiments.searchUsersPlaceholder")).toHaveValue(
      "Cora Admin",
    );
  });

  it("removes a member when remove button is clicked", async () => {
    server.mount(contract.users.searchUsers, { body: users });
    renderMembersCard([{ userId: "user-1", firstName: "Alice" }]);

    expect(screen.getByText(/Alice/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "common.remove" }));

    await waitFor(() => {
      expect(screen.queryByText(/Alice/)).not.toBeInTheDocument();
    });
  });

  it("names a picked collaborator with no name by the fallback, truncating long names", () => {
    server.mount(contract.users.searchUsers, { body: [] });
    renderMembersCard([
      { userId: "u1" },
      { userId: "u2", firstName: "Maximiliane-Konstantinopoulou-Vandenberghe" },
    ]);

    expect(screen.getByText("common.unnamedAccount")).toBeInTheDocument();
    expect(screen.getByText("Maximiliane-Konstantinopoulou-Vandenberghe")).toHaveClass("truncate");
  });

  it("lists every picked collaborator — the form carries no tier to choose", () => {
    server.mount(contract.users.searchUsers, { body: [] });
    renderMembersCard([
      { userId: "u1", firstName: "First" },
      { userId: "u2", firstName: "Second" },
      { userId: "u3", firstName: "Third" },
    ]);

    for (const name of ["First", "Second", "Third"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });
});

describe("describeNewExperimentCandidate", () => {
  const t = (key: string) => key;

  it("greys out somebody already added", () => {
    const user = createUserProfile({ userId: "u-1" });

    expect(
      describeNewExperimentCandidate(user, { addedUserIds: ["u-1"], typedEmail: null, t })
        .unavailableReason,
    ).toBe("newExperiment.alreadyAdded");
    expect(
      describeNewExperimentCandidate(user, { addedUserIds: [], typedEmail: null, t })
        .unavailableReason,
    ).toBeNull();
  });

  it("hands back the searched profile on pick", () => {
    const user = createUserProfile({ userId: "u-1", firstName: "Lin", lastName: "Zhao" });
    const row = describeNewExperimentCandidate(user, { addedUserIds: [], typedEmail: null, t });

    expect(row.label).toBe("Lin Zhao");
    expect(row.value).toBe(user);
  });
});
