"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import type { Document } from "@contentful/rich-text-types";
import React from "react";

import { useTranslation } from "@repo/i18n";

import type { PageTermsAndConditionsFieldsFragment } from "../lib/__generated/sdk";

interface TermsAndConditionsContentProps {
  termsAndConditions: PageTermsAndConditionsFieldsFragment | null;
  locale: string;
  preview: boolean;
}

export const TermsAndConditionsContent: React.FC<TermsAndConditionsContentProps> = ({
  termsAndConditions,
  locale,
  preview,
}) => {
  const { t } = useTranslation();

  if (!termsAndConditions) {
    return (
      <div className="text-muted-foreground space-y-2 text-sm">
        <p>{t("errors.termsContentUnavailable")}</p>
      </div>
    );
  }

  // Enable live updates only in preview mode
  const liveTermsAndConditions = useContentfulLiveUpdates<PageTermsAndConditionsFieldsFragment>(
    termsAndConditions,
    {
      locale,
      skip: !preview,
    },
  );

  // Use fallback to original data
  const currentTermsAndConditions = liveTermsAndConditions ?? termsAndConditions;

  // Inspector mode tagging
  const inspectorProps = useContentfulInspectorMode({
    entryId: currentTermsAndConditions.sys?.id,
    locale,
  });

  return (
    <div className="space-y-2 text-sm">
      {currentTermsAndConditions.content?.json ? (
        <div {...inspectorProps({ fieldId: "content" })}>
          {documentToReactComponents(currentTermsAndConditions.content.json as Document)}
        </div>
      ) : null}
    </div>
  );
};

// Separate client component for the title with inspector mode
export const TermsAndConditionsTitle: React.FC<{
  termsAndConditions: PageTermsAndConditionsFieldsFragment | null;
  locale: string;
  preview?: boolean;
}> = ({ termsAndConditions, locale, preview = false }) => {
  const { t } = useTranslation();

  if (!termsAndConditions) {
    return <span>{t("registration.termsAndConditions")}</span>;
  }

  // Enable live updates for the title
  const liveTermsAndConditions = useContentfulLiveUpdates<PageTermsAndConditionsFieldsFragment>(
    termsAndConditions,
    {
      locale,
      skip: !preview,
    },
  );

  // Use fallback to original data
  const currentTermsAndConditions = liveTermsAndConditions ?? termsAndConditions;

  // Inspector mode tagging for title
  const inspectorProps = useContentfulInspectorMode({
    entryId: currentTermsAndConditions.sys?.id,
    locale,
  });

  return (
    <span {...inspectorProps({ fieldId: "title" })}>
      {currentTermsAndConditions.title ?? t("registration.termsAndConditions")}
    </span>
  );
};
