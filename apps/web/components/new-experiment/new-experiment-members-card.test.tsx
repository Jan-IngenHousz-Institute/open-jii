import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderWithForm, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";
import type { CreateExperimentBody } from "@repo/api";
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

vi.mock("../current-members-list/current-members-list", () => ({
  MemberList: ({
    members,
    onRemoveMember,
    adminCount,
  }: {
    members?: { userId: string; firstName?: string; user?: { firstName?: string } }[];
    onRemoveMember: (userId: string) => void;
    adminCount?: number;
  }) => (
    <div>
      {members?.map((m) => (
        <div key={m.userId}>
          <span>{m.firstName ?? m.user?.firstName}</span>
          <button
            aria-label={`remove member ${m.firstName ?? m.user?.firstName}`}
            onClick={() => onRemoveMember(m.userId)}
          >
            Remove
          </button>
        </div>
      ))}
      {adminCount !== undefined && <p>{adminCount} admin(s)</p>}
    </div>
  ),
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
  createUserProfile({ userId: "user-1", firstName: "Alice", lastName: "Tester" }),
  createUserProfile({ userId: "user-2", firstName: "Bob", lastName: "Tester" }),
];

describe("<NewExperimentMembersCard />", () => {
  it("renders title and description", () => {
    server.mount(contract.users.searchUsers, { body: [] });
    renderMembersCard([]);
    expect(screen.getByText("newExperiment.addMembersTitle")).toBeInTheDocument();
    expect(screen.getByText("newExperiment.addMembersDescription")).toBeInTheDocument();
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
      expect(screen.getByText(/Alice/)).toBeInTheDocument();
    });
  });

  it("removes a member when remove button is clicked", async () => {
    server.mount(contract.users.searchUsers, { body: users });
    renderMembersCard([{ userId: "user-1", role: "member", firstName: "Alice" }]);

    expect(screen.getByText(/Alice/)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/remove.*alice/i));

    await waitFor(() => {
      expect(screen.queryByText(/Alice/)).not.toBeInTheDocument();
    });
  });

  it("computes adminCount correctly", () => {
    server.mount(contract.users.searchUsers, { body: [] });
    renderMembersCard([
      { userId: "u1", role: "admin", firstName: "Admin1" },
      { userId: "u2", role: "admin", firstName: "Admin2" },
      { userId: "u3", role: "member", firstName: "Member1" },
    ]);

    expect(screen.getByText("2 admin(s)")).toBeInTheDocument();
  });
});
