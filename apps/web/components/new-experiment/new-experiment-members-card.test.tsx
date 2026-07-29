import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderWithForm, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import type { CreateExperimentBody } from "@repo/api/domains/experiment/experiment.schema";
import { useSession } from "@repo/auth/client";

import { NewExperimentMembersCard } from "./new-experiment-members-card";

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

  it("removes a member when remove button is clicked", async () => {
    server.mount(contract.users.searchUsers, { body: users });
    renderMembersCard([{ userId: "user-1", firstName: "Alice" }]);

    expect(screen.getByText(/Alice/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "common.remove" }));

    await waitFor(() => {
      expect(screen.queryByText(/Alice/)).not.toBeInTheDocument();
    });
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
