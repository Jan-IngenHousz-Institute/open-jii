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
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const [popoverWidth, setPopoverWidth] = React.useState<number>();

    // ResizeObserver to track button width
    React.useEffect(() => {
        if (!buttonRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setPopoverWidth(entry.contentRect.width);
            }
        });

        observer.observe(buttonRef.current);

        return () => {
            observer.disconnect();
        };
    }, []);

    const selectedOption = options.find((option) => option.value === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    ref={buttonRef}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full max-w-[240px] justify-between p-0"
                >
                    <div className="flex w-full items-center justify-between px-3 py-2">
                        {selectedOption ? selectedOption.label : placeholder}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                style={{ width: popoverWidth }}
                className="p-0 box-border"
            >
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
                                        <div className="flex-1 overflow-hidden">
                                            {option.label}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                await onAddUser(option.value);
                                                setOpen(false);
                                                onSearchChange("");
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