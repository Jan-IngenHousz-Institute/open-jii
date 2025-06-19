"use client";

import { ChevronsUpDown } from "lucide-react";
import React, { useState } from "react";

import type { User } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components";
import { Popover, PopoverTrigger } from "@repo/ui/components";

import { UserSearchPopover } from "./user-search-popover";

export interface UserSearchWithDropdownProps {
  availableUsers: User[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAddUser: (userId: string) => void | Promise<void>;
  isAddingUser: boolean;
}

export function UserSearchWithDropdown({
  availableUsers,
  value,
  placeholder,
  loading = false,
  searchValue,
  onSearchChange,
  onAddUser,
  isAddingUser,
}: UserSearchWithDropdownProps) {
  const { t } = useTranslation(undefined, "common");
  const [open, setOpen] = useState(false);

  const selectedUser = availableUsers.find((user) => user.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full max-w-60 justify-between p-0"
        >
          <div className="flex w-full items-center justify-between px-3 py-2">
            {selectedUser ? (
              <div className="flex flex-col">
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {selectedUser.name}
                </span>
                <span className="text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                  {selectedUser.email}
                </span>
              </div>
            ) : (
              (placeholder ?? t("common.searchUsers"))
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <UserSearchPopover
        availableUsers={availableUsers}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onAddUser={onAddUser}
        isAddingUser={isAddingUser}
        loading={loading}
        setOpen={setOpen}
      />
    </Popover>
  );
}
