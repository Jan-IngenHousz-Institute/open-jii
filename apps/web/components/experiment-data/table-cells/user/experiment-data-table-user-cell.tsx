"use client";

import React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components";

interface ExperimentDataTableUserCellProps {
  data: string; // JSON string representation of the user object
  columnName: string;
}

interface UserData {
  id: string;
  name: string;
  avatar: string | null;
}

function parseUserData(data: string): UserData | null {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      "name" in parsed &&
      "avatar" in parsed
    ) {
      return parsed as UserData;
    }
  } catch {
    // If JSON parsing fails, return null
    return null;
  }
  return null;
}

function getInitials(name: string): string {
  if (!name || name.trim().length === 0) {
    return "U";
  }

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  // Use first letter of first name and first letter of last name
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ExperimentDataTableUserCell({
  data,
  columnName: _columnName,
}: ExperimentDataTableUserCellProps) {
  const userData = parseUserData(data);

  // If we can't parse the data as a user object, display unknown user fallback
  if (!userData) {
    return (
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6 rounded-full">
          <AvatarFallback className="rounded-full text-xs">U</AvatarFallback>
        </Avatar>
        <span className="text-muted-foreground max-w-[120px] truncate text-sm font-medium">
          Unknown User
        </span>
      </div>
    );
  }

  const { name, avatar } = userData;
  const initials = getInitials(name);

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6 rounded-full">
        <AvatarImage src={avatar ?? undefined} alt={name} />
        <AvatarFallback className="rounded-full text-xs">{initials}</AvatarFallback>
      </Avatar>
      <span className="max-w-[120px] truncate text-sm font-medium">{name || "Unknown User"}</span>
    </div>
  );
}
