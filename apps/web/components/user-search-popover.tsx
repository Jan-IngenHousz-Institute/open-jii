"use client";

import { Search, X } from "lucide-react";
import React, { useState } from "react";

import type { UserProfile } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Input, Popover, PopoverAnchor, PopoverContent, Button } from "@repo/ui/components";

export interface UserSearchPopoverProps {
  availableUsers: UserProfile[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  isAddingUser: boolean;
  loading: boolean;
  onSelectUser: (user: UserProfile) => void;
  placeholder?: string;
  selectedUser: UserProfile | null;
  onClearSelection: () => void;
}

export function UserSearchPopover({
  availableUsers,
  searchValue,
  onSearchChange,
  isAddingUser,
  loading,
  onSelectUser,
  placeholder,
  selectedUser,
  onClearSelection,
}: UserSearchPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onSearchChange(value);
    setOpen(value.length > 0);
  };

  const handleSelectUser = (user: UserProfile) => {
    onSelectUser(user);
    onSearchChange("");
    setOpen(false);
  };

  const handleClear = () => {
    onClearSelection();
    onSearchChange("");
    setOpen(false);
  };

  // Show selected user name or search value
  const displayValue = selectedUser
    ? `${selectedUser.firstName} ${selectedUser.lastName}`
    : searchValue;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor className="min-w-[190px] flex-1" asChild>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            value={displayValue}
            onChange={handleSearchChange}
            placeholder={placeholder ?? t("experiments.searchUsers")}
            disabled={isAddingUser}
            className="pl-9 pr-9"
            readOnly={!!selectedUser}
            onClick={() => {
              if (selectedUser) {
                handleClear();
              }
            }}
          />
          {(searchValue || selectedUser) && (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </PopoverAnchor>

      <PopoverContent
        className="max-h-[300px] w-[var(--radix-popover-trigger-width)] overflow-y-auto p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {loading ? (
          <div className="text-muted-foreground p-4 text-center text-sm">{t("common.loading")}</div>
        ) : availableUsers.length > 0 ? (
          <div className="space-y-3 py-1">
            {availableUsers.map((user) => (
              <Button
                key={user.userId}
                variant="ghost"
                type="button"
                onClick={() => handleSelectUser(user)}
                onMouseDown={(e) => e.preventDefault()}
                className="hover:bg-accent flex w-full items-center px-3 text-left"
              >
                <div className="flex-1 overflow-hidden">
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                    {user.email}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground p-4 text-center text-sm">
            {searchValue
              ? t("experiments.noUsersFound", { search: searchValue })
              : t("experiments.startTypingToSearch")}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
