import { render, screen, userEvent } from "@/test/test-utils";
import * as nav from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { nameColumn, updatedColumn } from "./name-updated-columns";
import { OverviewTable } from "./overview-table";

const row = { id: "r-1", name: "Leaf map", updatedAt: "2024-03-01T00:00:00.000Z" };

function renderRow() {
  return render(
    <OverviewTable
      columns={[nameColumn("Name"), updatedColumn("Updated")]}
      items={[row]}
      getRowKey={(item) => item.id}
      getRowHref={(item) => `/platform/things/${item.id}`}
      emptyMessage="Nothing here"
    />,
  );
}

describe("nameColumn", () => {
  beforeEach(() => {
    vi.mocked(nav.useRouter().push).mockClear();
  });

  it("links the name to the row's page", () => {
    renderRow();

    expect(screen.getByRole("link", { name: "Leaf map" })).toHaveAttribute(
      "href",
      "/platform/things/r-1",
    );
  });

  it("keeps a click on the name from also opening the row", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("link", { name: "Leaf map" }));

    expect(nav.useRouter().push).not.toHaveBeenCalled();
  });
});
