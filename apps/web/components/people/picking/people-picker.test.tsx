import { fireEvent, render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { PeoplePicker } from "./people-picker";
import type { PickerRow } from "./picking-rule";

function person(id: string, name: string, email: string | null = null): PickerRow<string> {
  const [firstName, lastName] = name.split(" ");
  return {
    key: id,
    kind: "user",
    label: name,
    person: { id, firstName, lastName, email },
    badges: [],
    unavailableReason: null,
    value: id,
  };
}

type PickerProps = React.ComponentProps<typeof PeoplePicker<string>>;

function Harness(props: Partial<PickerProps>) {
  const [term, setTerm] = useState("");
  return (
    <PeoplePicker<string>
      term={term}
      onTermChange={setTerm}
      selectionLabel={null}
      onClear={vi.fn()}
      placeholder="Search"
      ariaLabel="search"
      status={{ isLoading: false, isError: false, onRetry: vi.fn() }}
      rows={[]}
      onPick={vi.fn()}
      emptyMessage="Nobody found"
      {...props}
    />
  );
}

function invite(overrides: Partial<NonNullable<PickerProps["emailInvite"]>> = {}) {
  return {
    offer: false,
    reason: "noMatch" as const,
    label: "Invite",
    onPick: vi.fn(),
    messages: { invited: "Already invited", member: "Already a member" },
    ...overrides,
  };
}

const box = () => screen.getByRole("textbox", { name: "search" });

describe("<PeoplePicker />", () => {
  it("prompts for two characters before showing results", async () => {
    render(<Harness rows={[person("u-1", "Cora Admin")]} />);

    await userEvent.type(box(), "C");

    expect(screen.getByText("common.searchMinCharacters")).toBeVisible();
    expect(screen.queryByText("Cora Admin")).not.toBeInTheDocument();
    expect(screen.queryByText("Nobody found")).not.toBeInTheDocument();
  });

  it("says it is loading rather than that nobody matched", async () => {
    render(<Harness status={{ isLoading: true, isError: false, onRetry: vi.fn() }} />);

    await userEvent.type(box(), "Cora");

    expect(screen.getByText("common.loading")).toBeVisible();
    expect(screen.queryByText("Nobody found")).not.toBeInTheDocument();
  });

  it("reports a failed search with Try again, never as nothing found or an invitation", async () => {
    const onRetry = vi.fn();
    render(
      <Harness
        status={{ isLoading: false, isError: true, onRetry }}
        emailInvite={invite({ offer: true })}
      />,
    );

    await userEvent.type(box(), "new@uni.edu");

    expect(screen.getByText("common.searchFailed")).toBeVisible();
    expect(screen.queryByText("Nobody found")).not.toBeInTheDocument();
    expect(screen.queryByText("Invite")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "errors.tryAgain" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the site's message when nothing matches", async () => {
    render(<Harness />);

    await userEvent.type(box(), "Cora");

    expect(screen.getByText("Nobody found")).toBeVisible();
  });

  it("lists rows, greys out an unpickable one with its reason, and picks the rest", async () => {
    const onPick = vi.fn();
    render(
      <Harness
        rows={[
          { ...person("u-1", "Mel Member"), unavailableReason: "Already added" },
          person("u-2", "New Person", "new@uni.edu"),
        ]}
        onPick={onPick}
      />,
    );

    await userEvent.type(box(), "pe");

    const greyed = screen.getByRole("button", { name: /Mel Member/u });
    expect(greyed).toBeDisabled();
    expect(within(greyed).getByText("Already added")).toBeVisible();
    await userEvent.click(within(greyed).getByText("Mel Member"));
    expect(onPick).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText("New Person"));
    expect(onPick).toHaveBeenCalledWith("u-2");
    // A pick closes the list and clears the box.
    expect(screen.queryByText("Mel Member")).not.toBeInTheDocument();
    expect(box()).toHaveValue("");
  });

  it("shows a named user without an address on one line, and picks them", async () => {
    const onPick = vi.fn();
    render(<Harness rows={[person("cora", "Cora Admin")]} onPick={onPick} />);

    await userEvent.type(box(), "Cora");

    const row = screen.getByRole("button", { name: /Cora Admin/u });
    expect(row.querySelectorAll(".text-xs")).toHaveLength(0);
    await userEvent.click(row);
    expect(onPick).toHaveBeenCalledWith("cora");
  });

  it("offers the invitation row alone when nobody matches, and under the rows otherwise", async () => {
    const onInvite = vi.fn();
    const offered = invite({ offer: true, onPick: onInvite });
    const { rerender } = render(<Harness emailInvite={offered} />);

    await userEvent.type(box(), "new@uni.edu");
    expect(screen.queryByText("Nobody found")).not.toBeInTheDocument();
    expect(screen.getByText("Invite")).toBeVisible();

    rerender(<Harness emailInvite={offered} rows={[person("u-1", "New Candidate")]} />);
    await userEvent.clear(box());
    await userEvent.type(box(), "new@uni.edu");
    expect(screen.getByText("New Candidate")).toBeVisible();
    await userEvent.click(screen.getByText("Invite"));
    expect(onInvite).toHaveBeenCalledWith("new@uni.edu");
  });

  it("says why a typed address cannot be invited, in place of nothing found or under the rows", async () => {
    const { rerender } = render(<Harness emailInvite={invite({ reason: "invited" })} />);

    await userEvent.type(box(), "lin@uni.edu");
    expect(screen.getByText("Already invited")).toBeVisible();
    expect(screen.queryByText("Nobody found")).not.toBeInTheDocument();

    rerender(
      <Harness emailInvite={invite({ reason: "member" })} rows={[person("u-1", "Lin Zhao")]} />,
    );
    await userEvent.clear(box());
    await userEvent.type(box(), "lin@uni.edu");
    expect(screen.getByText("Lin Zhao")).toBeVisible();
    expect(screen.getByText("Already a member")).toBeVisible();
  });

  it("leaves a registered address to its own row, and calls it a member once no row is left", async () => {
    const { rerender } = render(
      <Harness emailInvite={invite({ reason: "registered" })} rows={[person("u-1", "Lin Zhao")]} />,
    );

    await userEvent.type(box(), "lin@uni.edu");
    expect(screen.queryByText("Already a member")).not.toBeInTheDocument();

    rerender(<Harness emailInvite={invite({ reason: "registered" })} />);
    await userEvent.clear(box());
    await userEvent.type(box(), "lin@uni.edu");
    expect(screen.getByText("Already a member")).toBeVisible();
  });

  it("opens a browsable list on focus, and keeps it open when focus lands in the box", async () => {
    render(
      <Harness
        browsable
        rows={[{ ...person("org-1", "Greenhouse Lab"), kind: "organization", person: null }]}
      />,
    );

    await userEvent.click(box());
    await waitFor(() => expect(screen.getByText("Greenhouse Lab")).toBeInTheDocument());

    // In a browser the focus that opened the list also reaches the list's outside
    // listener; jsdom flushes effects too late for that, so it is delivered again.
    fireEvent.focusIn(box());

    expect(screen.getByText("Greenhouse Lab")).toBeInTheDocument();
  });

  it("keeps the people directory closed on focus", async () => {
    render(<Harness rows={[person("u-1", "Cora Admin")]} />);

    await userEvent.click(box());

    expect(screen.queryByText("common.searchMinCharacters")).not.toBeInTheDocument();
    expect(screen.queryByText("Cora Admin")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    render(<Harness rows={[person("u-1", "Cora Admin")]} />);

    await userEvent.type(box(), "Cora");
    expect(screen.getByText("Cora Admin")).toBeVisible();
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText("Cora Admin")).not.toBeInTheDocument());
  });

  it("shows a selection read-only and clears it on request", async () => {
    const onClear = vi.fn();
    render(<Harness selectionLabel="Lin Zhao" onClear={onClear} clearLabel="Clear" />);

    expect(box()).toHaveValue("Lin Zhao");
    expect(box()).toHaveAttribute("readonly");
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("locks the search box while disabled", () => {
    render(<Harness disabled />);

    expect(box()).toBeDisabled();
  });
});
