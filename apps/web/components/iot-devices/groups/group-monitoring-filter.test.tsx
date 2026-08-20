import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { GroupHealthSummary, MemberFilter } from "./group-health";
import { GroupMonitoringFilter } from "./group-monitoring-filter";

const SUMMARY: GroupHealthSummary = { total: 6, online: 3, unknown: 1, silent: 2 };
const ALL: MemberFilter = { search: "", status: "all" };

describe("GroupMonitoringFilter", () => {
  it("shows each status chip with its unfiltered count", () => {
    render(<GroupMonitoringFilter filter={ALL} onFilterChange={vi.fn()} summary={SUMMARY} />);

    expect(
      screen.getByRole("button", { name: "iot.groups.monitoring.filter.all 6" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "iot.groups.monitoring.onlineLabel 3" }),
    ).toBeInTheDocument();
    // Offline is the remainder: total minus online minus unknown.
    expect(
      screen.getByRole("button", { name: "iot.groups.monitoring.filter.offline 2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "iot.groups.monitoring.filter.silent 2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "iot.groups.monitoring.unknownLabel 1" }),
    ).toBeInTheDocument();
  });

  it("selects a chip's status while keeping the search", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    render(
      <GroupMonitoringFilter
        filter={{ search: "gateway", status: "all" }}
        onFilterChange={onFilterChange}
        summary={SUMMARY}
      />,
    );

    await user.click(screen.getByRole("button", { name: /filter.silent/ }));

    expect(onFilterChange).toHaveBeenCalledWith({ search: "gateway", status: "silent" });
  });

  it("reports what was typed into the search while keeping the status", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    render(
      <GroupMonitoringFilter
        filter={{ search: "", status: "online" }}
        onFilterChange={onFilterChange}
        summary={SUMMARY}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: "iot.groups.monitoring.filter.searchPlaceholder" }),
      "g",
    );

    expect(onFilterChange).toHaveBeenCalledWith({ search: "g", status: "online" });
  });
});
