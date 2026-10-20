import { WHATS_NEW_OPEN_EVENT } from "@/components/whats-new/whats-new-shared";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { WhatsNewSection } from "./whats-new-section";

const entries = [
  {
    id: "note-1",
    title: "Choose which notifications arrive by email",
    publishedAt: "2026-10-02T00:00:00.000+02:00",
    slug: "email-notifications",
  },
  {
    id: "note-2",
    title: "Sort any list by up to two columns",
    publishedAt: "2026-09-24",
    slug: null,
  },
];

describe("WhatsNewSection", () => {
  it("lists the newest notes and opens the panel from See all", async () => {
    const opened = vi.fn();
    window.addEventListener(WHATS_NEW_OPEN_EVENT, opened);

    render(<WhatsNewSection entries={entries} locale="en-US" />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Sort any list by up to two columns")).toBeInTheDocument();
    // The day as entered, not the UTC moment it falls on.
    expect(screen.getByText("Oct 2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "dashboard.seeAll" }));
    expect(opened).toHaveBeenCalledTimes(1);
    window.removeEventListener(WHATS_NEW_OPEN_EVENT, opened);
  });

  it("links a note to its own page in a new tab, and lists one without a page as text", () => {
    render(<WhatsNewSection entries={entries} locale="en-US" />);

    const link = screen.getByRole("link", { name: "Choose which notifications arrive by email" });
    expect(link).toHaveAttribute("href", "/en-US/releases/email-notifications");
    expect(link).toHaveAttribute("target", "_blank");
    expect(
      screen.queryByRole("link", { name: "Sort any list by up to two columns" }),
    ).not.toBeInTheDocument();
  });

  it("renders nothing without notes", () => {
    const { container } = render(<WhatsNewSection entries={[]} locale="en-US" />);

    expect(container).toBeEmptyDOMElement();
  });
});
