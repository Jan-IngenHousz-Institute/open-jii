"use client";

import { SearchX, UserPlus } from "lucide-react";
import React from "react";

import type { User } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components";
import { PopoverContent } from "@repo/ui/components";

// Props for the UserList component
interface UserListProps {
  users: User[];
  onAddUser: (userId: string) => Promise<void> | void;
  isAddingUser: boolean;
  setOpen: (open: boolean) => void;
  onSearchChange: (value: string) => void;
}

// Display a list of user items with add buttons
function UserList({ users, onAddUser, isAddingUser, setOpen, onSearchChange }: UserListProps) {
  return (
    <>
      {users.map((user) => (
        <CommandItem key={user.id} value={user.id} className="flex items-center justify-between">
          <div className="flex-1 overflow-hidden">
            <div className="flex flex-col">
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">{user.name}</span>
              <span className="text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                {user.email}
              </span>
            </div>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={async (e) => {
              e.stopPropagation();
              await onAddUser(user.id);
              setOpen(false);
              onSearchChange("");
            }}
            disabled={isAddingUser}
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        </CommandItem>
      ))}
    </>
  );
}

// Props for the SearchStatus component
interface SearchStatusProps {
  loading: boolean;
  hasUsers: boolean;
  hasSearchQuery: boolean;
  searchValue: string;
}

// Display appropriate message based on search status
function SearchStatus({ loading, hasUsers, hasSearchQuery, searchValue }: SearchStatusProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">{t("common.loading")}</div>
    );
  }

  if (!hasUsers && hasSearchQuery) {
    return <CommandEmpty>{t("common.noUsersFound", { search: searchValue })}</CommandEmpty>;
  }

  if (!hasUsers && !hasSearchQuery) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">
        {t("experiments.startTypingToSearch")}
      </div>
    );
  }

  return null;
}

// Search field component with clear button
interface SearchFieldProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  isAddingUser: boolean;
}

function SearchField({ searchValue, onSearchChange, isAddingUser }: SearchFieldProps) {
  const { t } = useTranslation();

  return (
    <div className="relative">
      <CommandInput
        placeholder={t("experiments.searchUsers")}
        value={searchValue}
        onValueChange={onSearchChange}
        disabled={isAddingUser}
      />
      {searchValue && (
        <button
          type="button"
          onClick={() => onSearchChange("")}
          className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2 text-xl"
        >
          <SearchX />
        </button>
      )}
    </div>
  );
}

export interface UserSearchPopoverProps {
  availableUsers: User[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAddUser: (userId: string) => Promise<void> | void;
  isAddingUser: boolean;
  loading: boolean;
  setOpen: (open: boolean) => void;
}

export function UserSearchPopover({
  availableUsers,
  searchValue,
  onSearchChange,
  onAddUser,
  isAddingUser,
  loading,
  setOpen,
}: UserSearchPopoverProps) {
  const hasUsers = availableUsers.length > 0;
  const hasSearchQuery = searchValue.length > 0;

  return (
    <PopoverContent className="box-border w-fit p-0">
      <Command shouldFilter={false}>
        <SearchField
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          isAddingUser={isAddingUser}
        />

        <CommandList>
          <CommandGroup>
            {/* Show users list if there are available users and not loading */}
            {!loading && hasUsers && (
              <UserList
                users={availableUsers}
                onAddUser={onAddUser}
                isAddingUser={isAddingUser}
                setOpen={setOpen}
                onSearchChange={onSearchChange}
              />
            )}

            {/* Show appropriate status message */}
            <SearchStatus
              loading={loading}
              hasUsers={hasUsers}
              hasSearchQuery={hasSearchQuery}
              searchValue={searchValue}
            />
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  );
}
