import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { WorkbookSelect } from "./workbook-select";

const workbooks = [
  { id: "wb-1", name: "Alpha Workbook" },
  { id: "wb-2", name: "Beta Workbook" },
];

const labels = {
  triggerPlaceholder: "Select a workbook",
  searchPlaceholder: "Search workbooks...",
  emptyText: "No workbooks found",
};

describe("WorkbookSelect", () => {
  it("shows the placeholder and lists workbooks when opened", async () => {
    const user = userEvent.setup();
    render(<WorkbookSelect workbooks={workbooks} onChange={vi.fn()} {...labels} />);

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Select a workbook");

    await user.click(trigger);
    expect(screen.getByText("Alpha Workbook")).toBeInTheDocument();
    expect(screen.getByText("Beta Workbook")).toBeInTheDocument();
  });

  it("filters the list by name as the user types", async () => {
    const user = userEvent.setup();
    render(<WorkbookSelect workbooks={workbooks} onChange={vi.fn()} {...labels} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search workbooks..."), "beta");

    await waitFor(() => {
      expect(screen.queryByText("Alpha Workbook")).not.toBeInTheDocument();
      expect(screen.getByText("Beta Workbook")).toBeInTheDocument();
    });
  });

  it("calls onChange with the workbook id when one is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WorkbookSelect workbooks={workbooks} onChange={onChange} {...labels} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Alpha Workbook"));

    expect(onChange).toHaveBeenCalledWith("wb-1");
  });

  it("calls onChange with undefined when the none option is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <WorkbookSelect
        workbooks={workbooks}
        value="wb-1"
        onChange={onChange}
        noneLabel="None"
        {...labels}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Alpha Workbook");
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("None"));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("shows the empty text when nothing matches the search", async () => {
    const user = userEvent.setup();
    render(<WorkbookSelect workbooks={workbooks} onChange={vi.fn()} {...labels} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search workbooks..."), "zzzzz");

    await waitFor(() => expect(screen.getByText("No workbooks found")).toBeInTheDocument());
  });
});
