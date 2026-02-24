"use client";

import { Mail, Search, X } from "lucide-react";
import React, { useState } from "react";
import { z } from "zod";

import type { UserProfile } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Input,
  Popover,
  PopoverAnchor,
  PopoverContent,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";

const emailSchema = z.string().email();

function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value).success;
}

export interface UserSearchPopoverProps {
  availableUsers: UserProfile[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  isAddingUser: boolean;
  loading: boolean;
  onSelectUser: (user: UserProfile) => void;
  onSelectEmail?: (email: string) => void;
  placeholder?: string;
  selectedUser: UserProfile | null;
  selectedEmail?: string | null;
  onClearSelection: () => void;
  disabled?: boolean;
  selectedRole?: string;
  onRoleChange?: (role: string) => void;
}

export function UserSearchPopover({
  availableUsers,
  searchValue,
  onSearchChange,
  isAddingUser,
  loading,
  onSelectUser,
  onSelectEmail,
  placeholder,
  selectedUser,
  selectedEmail = null,
  onClearSelection,
  disabled = false,
  selectedRole = "member",
  onRoleChange,
}: UserSearchPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const isEmailSearch = isValidEmail(searchValue.trim());
  const hasSelection = !!selectedUser || !!selectedEmail;
  const canInviteByEmail = isEmailSearch && !!onSelectEmail;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const value = e.target.value;
    onSearchChange(value);
    setOpen(value.length > 0);
  };

  const handleSelectUser = (user: UserProfile) => {
    onSelectUser(user);
    onSearchChange("");
    setOpen(false);
  };

  const handleSelectEmail = () => {
    onSelectEmail?.(searchValue.trim());
    onSearchChange("");
    setOpen(false);
  };

  const handleClear = () => {
    onClearSelection();
    onSearchChange("");
    setOpen(false);
  };

  const displayValue = selectedUser
    ? `${selectedUser.firstName} ${selectedUser.lastName}`
    : (selectedEmail ?? searchValue);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor className="min-w-[190px] flex-1" asChild>
        <SearchInput
          displayValue={displayValue}
          handleSearchChange={handleSearchChange}
          placeholder={placeholder ?? t("experiments.searchUsers")}
          isAddingUser={isAddingUser}
          disabled={disabled}
          hasSelection={hasSelection}
          searchValue={searchValue}
          handleClear={handleClear}
          selectedRole={selectedRole}
          onRoleChange={onRoleChange}
          t={t}
        />
      </PopoverAnchor>

      <PopoverContent
        className="max-h-[300px] w-[var(--radix-popover-trigger-width)] overflow-y-auto p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <PopoverResults
          loading={loading}
          availableUsers={availableUsers}
          canInviteByEmail={canInviteByEmail}
          searchValue={searchValue}
          handleSelectUser={handleSelectUser}
          handleSelectEmail={handleSelectEmail}
          t={t}
        />
      </PopoverContent>
    </Popover>
  );
}

function SearchInput({
  displayValue,
  handleSearchChange,
  placeholder,
  isAddingUser,
  disabled,
  hasSelection,
  searchValue,
  handleClear,
  selectedRole,
  onRoleChange,
  t,
}: {
  displayValue: string | null;
  handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  isAddingUser: boolean;
  disabled: boolean;
  hasSelection: boolean;
  searchValue: string;
  handleClear: () => void;
  selectedRole: string;
  onRoleChange?: (role: string) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="border-input bg-background relative flex items-center gap-1 rounded-md border">
      <div className="relative flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          type="text"
          value={displayValue ?? ""}
          onChange={handleSearchChange}
          placeholder={placeholder}
          disabled={isAddingUser || disabled}
          className="border-0 pl-9 pr-9 focus-visible:ring-0"
          readOnly={hasSelection}
          onClick={() => {
            if (hasSelection && !disabled) {
              handleClear();
            }
          }}
        />
        {(searchValue || hasSelection) && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleClear}
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2 p-0 hover:bg-transparent disabled:pointer-events-none disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {hasSelection && (
        <>
          <div className="bg-border h-6 w-px" />
          <Select value={selectedRole} onValueChange={onRoleChange} disabled={disabled}>
            <SelectTrigger className="h-auto w-[100px] border-0 px-3 shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">{t("experimentSettings.roleMember")}</SelectItem>
              <SelectItem value="admin">{t("experimentSettings.roleAdmin")}</SelectItem>
            </SelectContent>
          </Select>
        </>
      )}
    </div>
  );
}

function InviteByEmailButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      className="hover:bg-surface flex w-full items-center gap-2 px-3 text-left"
    >
      <Mail className="text-muted-foreground h-4 w-4 shrink-0" />
      <div className="flex-1 overflow-hidden">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">{label}</div>
      </div>
    </Button>
  );
}

function PopoverResults({
  loading,
  availableUsers,
  canInviteByEmail,
  searchValue,
  handleSelectUser,
  handleSelectEmail,
  t,
}: {
  loading: boolean;
  availableUsers: UserProfile[];
  canInviteByEmail: boolean;
  searchValue: string;
  handleSelectUser: (user: UserProfile) => void;
  handleSelectEmail: () => void;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  if (loading) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">{t("common.loading")}</div>
    );
  }

  const inviteLabel = t("experiments.inviteByEmail", { email: searchValue.trim() });

  if (availableUsers.length > 0) {
    return (
      <div className="space-y-3 py-1">
        {availableUsers.map((user) => (
          <Button
            key={user.userId}
            variant="ghost"
            type="button"
            onClick={() => handleSelectUser(user)}
            onMouseDown={(e) => e.preventDefault()}
            className="hover:bg-surface flex w-full items-center px-3 text-left"
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
        {canInviteByEmail && (
          <InviteByEmailButton onClick={handleSelectEmail} label={inviteLabel} />
        )}
      </div>
    );
  }

  if (canInviteByEmail) {
    return (
      <div className="py-1">
        <InviteByEmailButton onClick={handleSelectEmail} label={inviteLabel} />
      </div>
    );
  }

  return (
    <div className="text-muted-foreground p-4 text-center text-sm">
      {searchValue
        ? t("experiments.noUsersFound", { search: searchValue })
        : t("experiments.startTypingToSearch")}
    </div>
  );
}
