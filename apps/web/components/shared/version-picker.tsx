"use client";

import { useLocale } from "@/hooks/useLocale";
import { useRouter, usePathname } from "next/navigation";
import React from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components";

interface VersionPickerProps {
  currentVersion: number;
  versions: { version: number; updatedAt: string }[];
}

export function VersionPicker({ currentVersion, versions }: VersionPickerProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleVersionChange = (value: string) => {
    const selectedVersion = Number(value);
    const latestVersion = Math.max(...versions.map((v) => v.version));
    if (selectedVersion === latestVersion) {
      // Latest version — remove query param
      router.push(pathname);
    } else {
      router.push(`${pathname}?v=${selectedVersion}`);
    }
  };

  return (
    <Select value={String(currentVersion)} onValueChange={handleVersionChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {versions.map((v) => (
          <SelectItem key={v.version} value={String(v.version)}>
            v{v.version}
            {v.version === Math.max(...versions.map((ver) => ver.version)) ? " (latest)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
