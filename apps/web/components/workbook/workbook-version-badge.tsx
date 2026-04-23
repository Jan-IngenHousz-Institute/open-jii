import { ArrowUpCircle } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";

interface WorkbookVersionBadgeProps {
  /** The version number currently pinned */
  currentVersion: number;
  /** The latest available version number (if different from current, shows upgrade indicator) */
  latestVersion?: number;
  /** Whether to show the upgrade-available badge alongside the version */
  showUpgrade?: boolean;
}

/**
 * Displays the pinned workbook version badge with an optional upgrade indicator.
 */
export function WorkbookVersionBadge({
  currentVersion,
  latestVersion,
  showUpgrade = true,
}: WorkbookVersionBadgeProps) {
  const hasUpgrade = latestVersion != null && latestVersion > currentVersion;

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge className="h-6 rounded border-0 bg-[#E7EDF2] px-2 py-1 text-xs font-medium text-[#011111] shadow-none hover:bg-[#E7EDF2]">
        v{currentVersion}
      </Badge>
      {showUpgrade && hasUpgrade && (
        <Badge className="h-6 gap-1 rounded border-0 bg-[#CCFCD8] px-2 py-1 text-xs font-medium text-[#011111] shadow-none hover:bg-[#CCFCD8]">
          <ArrowUpCircle className="h-3 w-3" />v{latestVersion} available
        </Badge>
      )}
    </span>
  );
}
