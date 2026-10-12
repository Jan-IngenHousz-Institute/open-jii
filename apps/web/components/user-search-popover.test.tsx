import { createUserProfile } from "@/test/factories";
import { render, screen, userEvent, within } from "@/test/test-utils";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { UserSearchPopover } from "./user-search-popover";

describe("UserSearchPopover", () => {
  it("shows and selects a named user without an address", async () => {
    const onSelectUser = vi.fn();
    const user = createUserProfile({
      userId: "cora",
      firstName: "Cora",
      lastName: "Admin",
      email: null,
    });

    function Picker() {
      const [searchValue, setSearchValue] = useState("");
      return (
        <UserSearchPopover
          availableUsers={[user]}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          isAddingUser={false}
          loading={false}
          onSelectUser={onSelectUser}
          selectedUser={null}
          onClearSelection={vi.fn()}
        />
      );
    }

    render(<Picker />);
    await userEvent.type(screen.getByRole("textbox"), "Cora");
    const row = screen.getByText("Cora Admin").closest("button");
    expect(row).not.toBeNull();
    if (!row) return;
    expect(within(row).getByText("Cora Admin")).toBeVisible();
    expect(row.querySelectorAll(".text-xs")).toHaveLength(0);
    await userEvent.click(row);
    expect(onSelectUser).toHaveBeenCalledWith(user);
  });
});
