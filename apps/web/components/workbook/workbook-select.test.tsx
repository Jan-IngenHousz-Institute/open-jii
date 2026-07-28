import { createWorkbook } from "@/test/factories";
import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { WorkbookSelect } from "./workbook-select";

const alpha = createWorkbook({ name: "Alpha Workbook" });
const beta = createWorkbook({ name: "Beta Workbook" });

const labels = {
  triggerPlaceholder: "Select a workbook",
  searchPlaceholder: "Search workbooks...",
  emptyText: "No workbooks found",
};

/** Mount the list endpoint, answering each request from its `search` query param. */
function mountList(respond: (search: string | undefined) => unknown[]) {
  return server.mount(contract.workbooks.listWorkbooks, {
    body: (call: SpyCall) => respond(call.query.search),
  });
}

const optionNames = () => screen.getAllByRole("option").map((o) => o.textContent.trim());

describe("WorkbookSelect", () => {
  it("shows the placeholder and lists workbooks when opened", async () => {
    const user = userEvent.setup();
    mountList(() => [alpha, beta]);
    render(<WorkbookSelect onChange={vi.fn()} {...labels} />);

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Select a workbook");

    await user.click(trigger);
    await waitFor(() => expect(screen.getByText("Alpha Workbook")).toBeInTheDocument());
    expect(screen.getByText("Beta Workbook")).toBeInTheDocument();
  });

  it("sends the typed search to the server", async () => {
    const user = userEvent.setup();
    const spy = mountList((search) => (search ? [beta] : [alpha, beta]));
    render(<WorkbookSelect onChange={vi.fn()} {...labels} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search workbooks..."), "beta");

    await waitFor(() => expect(spy.calls.at(-1)?.query.search).toBe("beta"));
  });

  it("debounces so a burst of keystrokes is one request", async () => {
    const user = userEvent.setup();
    const spy = mountList(() => [alpha]);
    render(<WorkbookSelect onChange={vi.fn()} {...labels} />);

    await user.click(screen.getByRole("combobox"));
    await waitFor(() => expect(spy.callCount).toBe(1));

    await user.type(screen.getByPlaceholderText("Search workbooks..."), "alpha");

    await waitFor(() => expect(spy.calls.at(-1)?.query.search).toBe("alpha"));
    // The initial list plus one request for the settled term, not one per keystroke.
    expect(spy.callCount).toBe(2);
  });

  it("renders the server's results as-is, including matches the name does not explain", async () => {
    const user = userEvent.setup();
    // The server also matches creator and linked entity names, so a result whose own
    // name lacks the query is legitimate and must not be filtered out again here.
    const byCreator = createWorkbook({ name: "Sable Notebook", createdByName: "Ada Lovelace" });
    mountList((search) => (search === "lovelace" ? [byCreator] : [alpha, beta]));
    render(<WorkbookSelect onChange={vi.fn()} {...labels} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search workbooks..."), "lovelace");

    await waitFor(() => expect(optionNames()).toEqual(["Sable Notebook"]));
  });

  it("preserves the server's ranking", async () => {
    const user = userEvent.setup();
    const ranked = [
      createWorkbook({ name: "Zulu Trial" }),
      createWorkbook({ name: "Alpha Trial" }),
    ];
    mountList((search) => (search ? ranked : []));
    render(<WorkbookSelect onChange={vi.fn()} {...labels} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search workbooks..."), "trial");

    await waitFor(() => expect(optionNames()).toEqual(["Zulu Trial", "Alpha Trial"]));
  });

  it("calls onChange with the workbook id when one is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    mountList(() => [alpha, beta]);
    render(<WorkbookSelect onChange={onChange} {...labels} />);

    await user.click(screen.getByRole("combobox"));
    await waitFor(() => expect(screen.getByText("Alpha Workbook")).toBeInTheDocument());
    await user.click(screen.getByText("Alpha Workbook"));

    expect(onChange).toHaveBeenCalledWith(alpha.id);
  });

  it("calls onChange with undefined when the none option is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    mountList(() => [alpha, beta]);
    render(<WorkbookSelect value={alpha.id} onChange={onChange} noneLabel="None" {...labels} />);

    await waitFor(() => expect(screen.getByRole("combobox")).toHaveTextContent("Alpha Workbook"));
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("None"));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("keeps workbooks with duplicate names selectable", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const duplicates = [
      createWorkbook({ name: "Shared Name" }),
      createWorkbook({ name: "Shared Name" }),
    ];
    mountList(() => duplicates);
    render(<WorkbookSelect onChange={onChange} {...labels} />);

    await user.click(screen.getByRole("combobox"));
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));
    await user.click(screen.getAllByRole("option")[1]);

    expect(onChange).toHaveBeenCalledWith(duplicates[1].id);
  });

  it("keeps the trigger label when a search narrows the selection out of the list", async () => {
    const user = userEvent.setup();
    mountList((search) => (search ? [beta] : [alpha, beta]));
    render(<WorkbookSelect value={alpha.id} onChange={vi.fn()} {...labels} />);

    // Held onto directly: cmdk's search input is also a combobox once the list opens.
    const trigger = screen.getByRole("combobox");
    await waitFor(() => expect(trigger).toHaveTextContent("Alpha Workbook"));
    await user.click(trigger);
    await user.type(screen.getByPlaceholderText("Search workbooks..."), "beta");

    await waitFor(() => expect(optionNames()).toEqual(["Beta Workbook"]));
    expect(trigger).toHaveTextContent("Alpha Workbook");
  });

  it("drops the trigger label once a settled unfiltered list no longer has the selection", async () => {
    const user = userEvent.setup();
    // Stands in for the workbook being deleted elsewhere: the unfiltered list stops
    // returning it, which is authoritative in a way a narrowed list is not.
    let deleted = false;
    server.mount(contract.workbooks.listWorkbooks, {
      body: (call: SpyCall) => {
        if (call.query.search) return [beta];
        return deleted ? [beta] : [alpha, beta];
      },
    });
    render(<WorkbookSelect value={alpha.id} onChange={vi.fn()} {...labels} />);

    const trigger = screen.getByRole("combobox");
    await waitFor(() => expect(trigger).toHaveTextContent("Alpha Workbook"));

    // Round-trip through a search and back to refetch the unfiltered list.
    await user.click(trigger);
    const input = screen.getByPlaceholderText("Search workbooks...");
    await user.type(input, "beta");
    await waitFor(() => expect(optionNames()).toEqual(["Beta Workbook"]));
    deleted = true;
    await user.clear(input);

    await waitFor(() => expect(trigger).toHaveTextContent("Select a workbook"));
  });

  it("shows a searching state instead of the empty text while results are in flight", async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    const unblock = new Promise((resolve) => {
      release = () => resolve(undefined);
    });
    server.mount(contract.workbooks.listWorkbooks, { body: [], unblock });
    render(<WorkbookSelect onChange={vi.fn()} {...labels} />);

    await user.click(screen.getByRole("combobox"));

    expect(screen.getByRole("status")).toHaveTextContent("experiments.searchingWorkbooks");
    expect(screen.queryByText("No workbooks found")).not.toBeInTheDocument();

    release?.();
    await waitFor(() => expect(screen.getByText("No workbooks found")).toBeInTheDocument());
  });

  it("shows the empty text when the server returns no matches", async () => {
    const user = userEvent.setup();
    mountList((search) => (search ? [] : [alpha, beta]));
    render(<WorkbookSelect onChange={vi.fn()} {...labels} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search workbooks..."), "zzzzz");

    await waitFor(() => expect(screen.getByText("No workbooks found")).toBeInTheDocument());
  });

  it("clears the search when reopened", async () => {
    const user = userEvent.setup();
    mountList((search) => (search ? [beta] : [alpha, beta]));
    render(<WorkbookSelect onChange={vi.fn()} {...labels} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search workbooks..."), "beta");
    await waitFor(() => expect(optionNames()).toEqual(["Beta Workbook"]));

    await user.click(screen.getByText("Beta Workbook"));
    await user.click(screen.getByRole("combobox"));

    expect(screen.getByPlaceholderText("Search workbooks...")).toHaveValue("");
    await waitFor(() => expect(optionNames()).toEqual(["Alpha Workbook", "Beta Workbook"]));
  });
});
