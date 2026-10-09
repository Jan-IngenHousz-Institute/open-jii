"use client";

import { useTranslation } from "@repo/i18n";

import type { FilterIssue } from "../../../data-filters/filter-operators";

const ISSUE_MESSAGE_KEYS: Record<FilterIssue, string> = {
  rangeMissingEnd: "widget.filterRangeMissingEnd",
  rangeMissingStart: "widget.filterRangeMissingStart",
  rangeReversed: "widget.filterRangeReversed",
  invalidValue: "widget.filterInvalidValue",
};

interface FilterIssueMessageProps {
  id: string;
  issue: FilterIssue;
}

export function FilterIssueMessage({ id, issue }: FilterIssueMessageProps) {
  const { t } = useTranslation("experimentDashboards");
  return (
    <p id={id} role="alert" className="text-destructive text-xs">
      {t(ISSUE_MESSAGE_KEYS[issue])}
    </p>
  );
}
