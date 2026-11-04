import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "~/test/test-utils";

import type { StatusDocument } from "@repo/monitoring/status-document";

import { NoticeBanner } from "./notice-banner";

type Notice = StatusDocument["notices"][number];

function notice(overrides: Partial<Notice> = {}): Notice {
  return {
    id: "n",
    title: "Field app update available",
    body: "Update it before your next field trip.",
    severity: "info",
    ...overrides,
  };
}

describe("NoticeBanner", () => {
  it("interrupts a screen reader only for a critical notice", () => {
    renderWithProviders(<NoticeBanner notice={notice({ severity: "critical" })} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Field app update available");
  });

  it.each(["info", "warning"] as const)("announces a %s notice politely", (severity) => {
    renderWithProviders(<NoticeBanner notice={notice({ severity })} />);

    expect(screen.getByRole("status")).toHaveTextContent("Field app update available");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the body under the title", () => {
    renderWithProviders(<NoticeBanner notice={notice()} />);

    expect(screen.getByText("Update it before your next field trip.")).toBeInTheDocument();
  });

  it("shows the title alone when the body is empty", () => {
    const { container } = renderWithProviders(<NoticeBanner notice={notice({ body: "" })} />);

    expect(screen.getByText("Field app update available")).toBeInTheDocument();
    expect(container.querySelector("[data-slot='alert-description']")).toBeNull();
  });
});
