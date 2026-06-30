import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { ExperimentJoinRequestsPanel } from "./experiment-join-requests-panel";

const EXPERIMENT_ID = "exp-1";

const MOCK_REQUEST = {
  id: "req-1",
  experimentId: EXPERIMENT_ID,
  user: {
    id: "user-1",
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    avatarUrl: null,
  },
  message: "Please let me join",
  status: "pending" as const,
  decidedBy: null,
  decidedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_REQUEST_NO_MESSAGE = {
  ...MOCK_REQUEST,
  id: "req-2",
  message: null,
  user: {
    ...MOCK_REQUEST.user,
    id: "user-2",
    firstName: "Bob",
    lastName: "Smith",
    email: "bob@example.com",
  },
};

describe("ExperimentJoinRequestsPanel", () => {
  beforeEach(() => {
    server.mount(orpcContract.experiments.listJoinRequests, { body: [] });
  });

  it("renders empty state when no requests", () => {
    render(<ExperimentJoinRequestsPanel experimentId={EXPERIMENT_ID} joinRequests={[]} />);
    expect(screen.getByText("experimentSettings.noJoinRequests")).toBeInTheDocument();
    expect(screen.getByText("experimentSettings.noJoinRequestsHint")).toBeInTheDocument();
  });

  it("renders request rows with name and email", () => {
    render(
      <ExperimentJoinRequestsPanel experimentId={EXPERIMENT_ID} joinRequests={[MOCK_REQUEST]} />,
    );
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("renders multiple request rows", () => {
    render(
      <ExperimentJoinRequestsPanel
        experimentId={EXPERIMENT_ID}
        joinRequests={[MOCK_REQUEST, MOCK_REQUEST_NO_MESSAGE]}
      />,
    );
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
  });

  describe("admin controls", () => {
    it("shows approve and reject buttons for admin", () => {
      render(
        <ExperimentJoinRequestsPanel
          experimentId={EXPERIMENT_ID}
          joinRequests={[MOCK_REQUEST]}
          isAdmin
        />,
      );
      expect(
        screen.getByRole("button", { name: "experimentSettings.approveJoinRequest" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "experimentSettings.rejectJoinRequest" }),
      ).toBeInTheDocument();
    });

    it("does not show approve/reject buttons for non-admin", () => {
      render(
        <ExperimentJoinRequestsPanel
          experimentId={EXPERIMENT_ID}
          joinRequests={[MOCK_REQUEST]}
          isAdmin={false}
        />,
      );
      expect(
        screen.queryByRole("button", { name: "experimentSettings.approveJoinRequest" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "experimentSettings.rejectJoinRequest" }),
      ).not.toBeInTheDocument();
    });

    it("does not show approve/reject buttons when archived", () => {
      render(
        <ExperimentJoinRequestsPanel
          experimentId={EXPERIMENT_ID}
          joinRequests={[MOCK_REQUEST]}
          isAdmin
          isArchived
        />,
      );
      expect(
        screen.queryByRole("button", { name: "experimentSettings.approveJoinRequest" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("approve", () => {
    it("calls approve API with correct params and shows success toast", async () => {
      const spy = server.mount(orpcContract.experiments.approveJoinRequest, {
        status: 200,
        body: MOCK_REQUEST,
      });
      const user = userEvent.setup();
      render(
        <ExperimentJoinRequestsPanel
          experimentId={EXPERIMENT_ID}
          joinRequests={[MOCK_REQUEST]}
          isAdmin
        />,
      );

      await user.click(
        screen.getByRole("button", { name: "experimentSettings.approveJoinRequest" }),
      );

      await waitFor(() => expect(spy.called).toBe(true));
      expect(spy.params).toMatchObject({ id: EXPERIMENT_ID, requestId: MOCK_REQUEST.id });

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          description: "experimentSettings.joinRequestApproved",
        });
      });
    });

    it("shows error toast when approve fails", async () => {
      server.mount(orpcContract.experiments.approveJoinRequest, {
        status: 500,
        body: { message: "Server error" },
      });
      const user = userEvent.setup();
      render(
        <ExperimentJoinRequestsPanel
          experimentId={EXPERIMENT_ID}
          joinRequests={[MOCK_REQUEST]}
          isAdmin
        />,
      );

      await user.click(
        screen.getByRole("button", { name: "experimentSettings.approveJoinRequest" }),
      );

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
      });
    });

    it("shows API error message when approve fails with known error", async () => {
      server.mount(orpcContract.experiments.approveJoinRequest, {
        status: 409,
        body: { message: "User is already a member" },
      });
      const user = userEvent.setup();
      render(
        <ExperimentJoinRequestsPanel
          experimentId={EXPERIMENT_ID}
          joinRequests={[MOCK_REQUEST]}
          isAdmin
        />,
      );

      await user.click(
        screen.getByRole("button", { name: "experimentSettings.approveJoinRequest" }),
      );

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          description: "User is already a member",
          variant: "destructive",
        });
      });
    });
  });

  describe("reject", () => {
    it("calls reject API with correct params and shows success toast", async () => {
      const spy = server.mount(orpcContract.experiments.rejectJoinRequest, {
        status: 200,
        body: MOCK_REQUEST,
      });
      const user = userEvent.setup();
      render(
        <ExperimentJoinRequestsPanel
          experimentId={EXPERIMENT_ID}
          joinRequests={[MOCK_REQUEST]}
          isAdmin
        />,
      );

      await user.click(
        screen.getByRole("button", { name: "experimentSettings.rejectJoinRequest" }),
      );

      await waitFor(() => expect(spy.called).toBe(true));
      expect(spy.params).toMatchObject({ id: EXPERIMENT_ID, requestId: MOCK_REQUEST.id });

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          description: "experimentSettings.joinRequestRejected",
        });
      });
    });

    it("shows error toast when reject fails", async () => {
      server.mount(orpcContract.experiments.rejectJoinRequest, {
        status: 500,
        body: { message: "Server error" },
      });
      const user = userEvent.setup();
      render(
        <ExperimentJoinRequestsPanel
          experimentId={EXPERIMENT_ID}
          joinRequests={[MOCK_REQUEST]}
          isAdmin
        />,
      );

      await user.click(
        screen.getByRole("button", { name: "experimentSettings.rejectJoinRequest" }),
      );

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
      });
    });

    it("shows API error message when reject fails with known error", async () => {
      server.mount(orpcContract.experiments.rejectJoinRequest, {
        status: 404,
        body: { message: "Request not found" },
      });
      const user = userEvent.setup();
      render(
        <ExperimentJoinRequestsPanel
          experimentId={EXPERIMENT_ID}
          joinRequests={[MOCK_REQUEST]}
          isAdmin
        />,
      );

      await user.click(
        screen.getByRole("button", { name: "experimentSettings.rejectJoinRequest" }),
      );

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          description: "Request not found",
          variant: "destructive",
        });
      });
    });
  });

  describe("message collapsible", () => {
    it("shows message trigger for each request", () => {
      render(
        <ExperimentJoinRequestsPanel experimentId={EXPERIMENT_ID} joinRequests={[MOCK_REQUEST]} />,
      );
      expect(screen.getByText("experimentSettings.joinRequestMessageLabel")).toBeInTheDocument();
    });

    it("expands to show message when trigger is clicked", async () => {
      const user = userEvent.setup();
      render(
        <ExperimentJoinRequestsPanel experimentId={EXPERIMENT_ID} joinRequests={[MOCK_REQUEST]} />,
      );

      await user.click(screen.getByText("experimentSettings.joinRequestMessageLabel"));

      expect(await screen.findByText("Please let me join")).toBeInTheDocument();
    });

    it("shows no-message text when request has no message", async () => {
      const user = userEvent.setup();
      render(
        <ExperimentJoinRequestsPanel
          experimentId={EXPERIMENT_ID}
          joinRequests={[MOCK_REQUEST_NO_MESSAGE]}
        />,
      );

      await user.click(screen.getByText("experimentSettings.joinRequestMessageLabel"));

      expect(
        await screen.findByText("experimentSettings.joinRequestNoMessage"),
      ).toBeInTheDocument();
    });
  });
});
