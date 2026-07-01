import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { ExperimentRequestToJoin } from "./experiment-request-to-join";

const EXPERIMENT_ID = "exp-1";

const MOCK_JOIN_REQUEST = {
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

describe("ExperimentRequestToJoin", () => {
  it("renders nothing while loading", () => {
    server.mount(contract.experiments.getMyJoinRequest, { delay: "infinite" });
    const { container } = render(<ExperimentRequestToJoin experimentId={EXPERIMENT_ID} />);
    expect(container.firstChild).toBeNull();
  });

  describe("no pending request", () => {
    it("renders request to join prompt", async () => {
      server.mount(contract.experiments.getMyJoinRequest, { status: 404 });
      render(<ExperimentRequestToJoin experimentId={EXPERIMENT_ID} />);
      await screen.findByText("experimentSettings.requestToJoinPrompt");
      expect(screen.getByText("experimentSettings.requestToJoin")).toBeInTheDocument();
    });

    it("opens dialog when clicking the request link", async () => {
      server.mount(contract.experiments.getMyJoinRequest, { status: 404 });
      const user = userEvent.setup();
      render(<ExperimentRequestToJoin experimentId={EXPERIMENT_ID} />);

      await user.click(await screen.findByText("experimentSettings.requestToJoin"));

      expect(screen.getByText("experimentSettings.requestToJoinTitle")).toBeInTheDocument();
    });

    it("submits request and shows success toast", async () => {
      server.mount(contract.experiments.getMyJoinRequest, { status: 404 });
      const spy = server.mount(contract.experiments.createJoinRequest, {
        status: 201,
        body: MOCK_JOIN_REQUEST,
      });
      const user = userEvent.setup();
      render(<ExperimentRequestToJoin experimentId={EXPERIMENT_ID} />);

      await user.click(await screen.findByText("experimentSettings.requestToJoin"));
      await user.click(screen.getByText("experimentSettings.requestToJoinSubmit"));

      await waitFor(() => expect(spy.called).toBe(true));
      expect(spy.params).toMatchObject({ id: EXPERIMENT_ID });

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          description: "experimentSettings.requestSubmitted",
        });
      });
    });

    it("submits request with message", async () => {
      server.mount(contract.experiments.getMyJoinRequest, { status: 404 });
      const spy = server.mount(contract.experiments.createJoinRequest, {
        status: 201,
        body: MOCK_JOIN_REQUEST,
      });
      const user = userEvent.setup();
      render(<ExperimentRequestToJoin experimentId={EXPERIMENT_ID} />);

      await user.click(await screen.findByText("experimentSettings.requestToJoin"));
      await user.type(
        screen.getByPlaceholderText("experimentSettings.requestToJoinPlaceholder"),
        "I would like to join",
      );
      await user.click(screen.getByText("experimentSettings.requestToJoinSubmit"));

      await waitFor(() => expect(spy.called).toBe(true));
      expect(spy.body).toMatchObject({ message: "I would like to join" });
    });

    it("closes dialog and resets form on success", async () => {
      server.mount(contract.experiments.getMyJoinRequest, { status: 404 });
      server.mount(contract.experiments.createJoinRequest, {
        status: 201,
        body: MOCK_JOIN_REQUEST,
      });
      const user = userEvent.setup();
      render(<ExperimentRequestToJoin experimentId={EXPERIMENT_ID} />);

      await user.click(await screen.findByText("experimentSettings.requestToJoin"));
      expect(screen.getByText("experimentSettings.requestToJoinTitle")).toBeInTheDocument();

      await user.click(screen.getByText("experimentSettings.requestToJoinSubmit"));

      await waitFor(() => {
        expect(screen.queryByText("experimentSettings.requestToJoinTitle")).not.toBeInTheDocument();
      });
    });

    it("shows error toast on submission failure", async () => {
      server.mount(contract.experiments.getMyJoinRequest, { status: 404 });
      server.mount(contract.experiments.createJoinRequest, {
        status: 500,
        body: { message: "Server error" },
      });
      const user = userEvent.setup();
      render(<ExperimentRequestToJoin experimentId={EXPERIMENT_ID} />);

      await user.click(await screen.findByText("experimentSettings.requestToJoin"));
      await user.click(screen.getByText("experimentSettings.requestToJoinSubmit"));

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
      });
    });

    it("shows API error message on known error", async () => {
      server.mount(contract.experiments.getMyJoinRequest, { status: 404 });
      server.mount(contract.experiments.createJoinRequest, {
        status: 409,
        body: { message: "You already have a pending request" },
      });
      const user = userEvent.setup();
      render(<ExperimentRequestToJoin experimentId={EXPERIMENT_ID} />);

      await user.click(await screen.findByText("experimentSettings.requestToJoin"));
      await user.click(screen.getByText("experimentSettings.requestToJoinSubmit"));

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          description: "You already have a pending request",
          variant: "destructive",
        });
      });
    });

    it("closes dialog when cancel button is clicked", async () => {
      server.mount(contract.experiments.getMyJoinRequest, { status: 404 });
      const user = userEvent.setup();
      render(<ExperimentRequestToJoin experimentId={EXPERIMENT_ID} />);

      await user.click(await screen.findByText("experimentSettings.requestToJoin"));
      expect(screen.getByText("experimentSettings.requestToJoinTitle")).toBeInTheDocument();

      await user.click(screen.getByText("experimentSettings.cancel"));
      expect(screen.queryByText("experimentSettings.requestToJoinTitle")).not.toBeInTheDocument();
    });
  });

  describe("pending request exists", () => {
    it("renders cancel request prompt", async () => {
      server.mount(contract.experiments.getMyJoinRequest, { body: MOCK_JOIN_REQUEST });
      render(<ExperimentRequestToJoin experimentId={EXPERIMENT_ID} />);

      await screen.findByText("experimentSettings.requestPendingDescription");
      expect(screen.getByText("experimentSettings.cancelRequest")).toBeInTheDocument();
    });

    it("cancels request and shows success toast", async () => {
      server.mount(contract.experiments.getMyJoinRequest, { body: MOCK_JOIN_REQUEST });
      const spy = server.mount(contract.experiments.cancelJoinRequest);
      const user = userEvent.setup();
      render(<ExperimentRequestToJoin experimentId={EXPERIMENT_ID} />);

      await user.click(await screen.findByText("experimentSettings.cancelRequest"));

      await waitFor(() => expect(spy.called).toBe(true));
      expect(spy.params).toMatchObject({ id: EXPERIMENT_ID, requestId: MOCK_JOIN_REQUEST.id });

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          description: "experimentSettings.requestCancelled",
        });
      });
    });

    it("shows error toast when cancel fails", async () => {
      server.mount(contract.experiments.getMyJoinRequest, { body: MOCK_JOIN_REQUEST });
      server.mount(contract.experiments.cancelJoinRequest, {
        status: 500,
        body: { message: "Could not cancel" },
      });
      const user = userEvent.setup();
      render(<ExperimentRequestToJoin experimentId={EXPERIMENT_ID} />);

      await user.click(await screen.findByText("experimentSettings.cancelRequest"));

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
      });
    });

    it("shows API error message when cancel fails with known error", async () => {
      server.mount(contract.experiments.getMyJoinRequest, { body: MOCK_JOIN_REQUEST });
      server.mount(contract.experiments.cancelJoinRequest, {
        status: 404,
        body: { message: "Request not found" },
      });
      const user = userEvent.setup();
      render(<ExperimentRequestToJoin experimentId={EXPERIMENT_ID} />);

      await user.click(await screen.findByText("experimentSettings.cancelRequest"));

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          description: "Request not found",
          variant: "destructive",
        });
      });
    });
  });
});
