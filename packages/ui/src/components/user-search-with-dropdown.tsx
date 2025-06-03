"use client";

import * as React from "react";
import { ChevronsUpDown, UserPlus } from "lucide-react";

import { Button } from "./button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "./command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "./popover";

export interface UserSearchWithDropdownOption {
    value: string;
    label: React.ReactNode;
}

export interface UserSearchWithDropdownProps {
    options: UserSearchWithDropdownOption[];
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    loading?: boolean;
    searchValue: string;
    onSearchChange: (value: string) => void;
    onAddUser: (userId: string) => Promise<void>;
    isAddingUser: boolean;
}

export function UserSearchWithDropdown({
    options,
    value,
    placeholder = "Search...",
    loading = false,
    searchValue,
    onSearchChange,
    onAddUser,
    isAddingUser,
}: UserSearchWithDropdownProps) {
    const [open, setOpen] = React.useState(false);

    const selectedOption = options.find((option) => option.value === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="justify-between min-w-[200px]"
                >
                    {selectedOption ? selectedOption.label : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
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
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xl"
                            >
                                ×
                            </button>
                        )}
                    </div>
                    <CommandList>
                        <CommandGroup>
                            {loading ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    Loading...
                                </div>
                            ) : options.length > 0 ? (
                                options.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        value={option.value}
                                        className="flex justify-between items-center"
                                        onSelect={() => { }}
                                    >
                                        <div className="flex-1">
                                            {option.label}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                await onAddUser(option.value);
                                            }}
                                            disabled={isAddingUser}
                                        >
                                            <UserPlus className="h-4 w-4" />
                                        </Button>
                                    </CommandItem>
                                ))
                            ) : searchValue ? (
                                <CommandEmpty>No users found for "{searchValue}"</CommandEmpty>
                            ) : (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    Start typing to search users
                                </div>
                            )}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
