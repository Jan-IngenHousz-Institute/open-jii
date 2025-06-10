"use client";

import { ChevronsUpDown, UserPlus, SearchX } from "lucide-react";
import React from "react";

import type { User } from "@repo/api";
import { Button } from "@repo/ui/components";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components";

export interface UserSearchWithDropdownProps {
  availableUsers: User[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAddUser: (userId: string) => Promise<void>;
  isAddingUser: boolean;
}

interface UserSearchPopoverProps {
  availableUsers: User[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAddUser: (userId: string) => Promise<void>;
  isAddingUser: boolean;
  loading: boolean;
  setOpen: (open: boolean) => void;
}

function UserSearchPopover({
  availableUsers,
  searchValue,
  onSearchChange,
  onAddUser,
  isAddingUser,
  loading,
  setOpen,
}: UserSearchPopoverProps) {
  const RenderContent = () => {
    if (loading) {
      return (
        <div className="text-muted-foreground p-4 text-center text-sm">
          Loading...
        </div>
      );
    }

    if (availableUsers.length > 0) {
      return availableUsers.map((user) => (
        <CommandItem
          key={user.id}
          value={user.id}
          className="flex items-center justify-between"
        >
          <div className="flex-1 overflow-hidden">
            <div className="flex flex-col">
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                {user.name}
              </span>
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
      ));
    }

    if (searchValue) {
      return <CommandEmpty>No users found for "{searchValue}"</CommandEmpty>;
    }

    return (
      <div className="text-muted-foreground p-4 text-center text-sm">
        Start typing to search users
      </div>
    );
  };

  return (
    <PopoverContent className="box-border w-fit p-0">
      <Command shouldFilter={false}>
        <div className="relative">
          <CommandInput
            placeholder="Search users..."
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
        <CommandList>
          <CommandGroup>
            <RenderContent />
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  );
}

export function UserSearchWithDropdown({
  availableUsers,
  value,
  placeholder = "Search...",
  loading = false,
  searchValue,
  onSearchChange,
  onAddUser,
  isAddingUser,
}: UserSearchWithDropdownProps) {
  const [open, setOpen] = React.useState(false);

  const selectedUser = availableUsers.find((user) => user.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full max-w-[240px] justify-between p-0"
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
              placeholder
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
