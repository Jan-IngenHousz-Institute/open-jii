import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";

import { TransferRequestForm } from "./transfer-request-form";

describe("TransferRequestForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form fields and submit button", () => {
    render(<TransferRequestForm />);

    expect(screen.getByPlaceholderText("transferRequest.projectIdPlaceholder")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("transferRequest.projectUrlPlaceholder"),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByText("transferRequest.submitButton")).toBeInTheDocument();
  });

  it("validates empty submission", async () => {
    render(<TransferRequestForm />);

    fireEvent.click(screen.getByText("transferRequest.submitButton"));

    await waitFor(() => {
      expect(screen.getAllByText(/required/i).length).toBeGreaterThan(0);
    });
  });

  it("requires consent checkbox", async () => {
    const user = userEvent.setup();
    render(<TransferRequestForm />);

    await user.type(screen.getByPlaceholderText("transferRequest.projectIdPlaceholder"), "123");
    await user.type(
      screen.getByPlaceholderText("transferRequest.projectUrlPlaceholder"),
      "https://example.com",
    );
    fireEvent.click(screen.getByText("transferRequest.submitButton"));

    await waitFor(() => {
      expect(screen.getByText(/ownership or permission/i)).toBeInTheDocument();
    });
  });

  it("submits valid form data", async () => {
    const spy = server.mount(contract.experiments.createTransferRequest, {
      body: { requestId: "req-1" },
    });
    const user = userEvent.setup();
    render(<TransferRequestForm />);

    await user.type(
      screen.getByPlaceholderText("transferRequest.projectIdPlaceholder"),
      "project-123",
    );
    await user.type(
      screen.getByPlaceholderText("transferRequest.projectUrlPlaceholder"),
      "https://photosynq.com/projects/123",
    );
    await user.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("transferRequest.submitButton"));

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });
    expect(spy.body).toMatchObject({
      projectIdOld: "project-123",
      projectUrlOld: "https://photosynq.com/projects/123",
      consent: true,
    });
  });

  it("shows success state and allows submitting another", async () => {
    server.mount(contract.experiments.createTransferRequest, {
      body: { requestId: "req-2" },
    });
    const user = userEvent.setup();
    render(<TransferRequestForm />);

    await user.type(screen.getByPlaceholderText("transferRequest.projectIdPlaceholder"), "test");
    await user.type(
      screen.getByPlaceholderText("transferRequest.projectUrlPlaceholder"),
      "https://test.com",
    );
    await user.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("transferRequest.submitButton"));

    await waitFor(() => {
      expect(screen.getByText("transferRequest.successTitle")).toBeInTheDocument();
    });

    await user.click(screen.getByText("transferRequest.submitAnother"));

    await waitFor(() => {
      expect(screen.getByText("transferRequest.submitButton")).toBeInTheDocument();
    });
  });
});
