"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import type { Document } from "@contentful/rich-text-types";
import React from "react";

import type { PageTermsAndConditionsFieldsFragment } from "@repo/cms/lib/__generated/sdk";
import { useTranslation } from "@repo/i18n";

import type { EmbeddedEntryType } from "./contentful/ctf-rich-text";
import { CtfRichText } from "./contentful/ctf-rich-text";

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

  // Enable live updates only in preview mode
  const liveTermsAndConditions =
    useContentfulLiveUpdates<PageTermsAndConditionsFieldsFragment | null>(termsAndConditions, {
      locale,
      skip: !preview,
    });

  // Use fallback to original data
  const currentTermsAndConditions = liveTermsAndConditions ?? termsAndConditions;

  // Inspector mode tagging
  const inspectorProps = useContentfulInspectorMode({
    entryId: currentTermsAndConditions?.sys?.id,
    locale,
  });

  if (!termsAndConditions || !currentTermsAndConditions) {
    return (
      <div className="text-muted-foreground space-y-2 text-sm">
        <p>{t("errors.termsContentUnavailable")}</p>
      </div>
    );
  }

  return (
    <div className="text-sm">
      {currentTermsAndConditions.content?.json && (
        <div {...inspectorProps({ fieldId: "content" })}>
          <CtfRichText json={currentTermsAndConditions.content.json as Document} />
        </div>
      )}
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

  // Enable live updates for the title
  const liveTermsAndConditions =
    useContentfulLiveUpdates<PageTermsAndConditionsFieldsFragment | null>(termsAndConditions, {
      locale,
      skip: !preview,
    });

  // Use fallback to original data
  const currentTermsAndConditions = liveTermsAndConditions ?? termsAndConditions;

  // Inspector mode tagging for title
  const inspectorProps = useContentfulInspectorMode({
    entryId: currentTermsAndConditions?.sys?.id,
    locale,
  });

  if (!termsAndConditions || !currentTermsAndConditions) {
    return <span>{t("registration.termsAndConditions")}</span>;
  }

  return (
    <span {...inspectorProps({ fieldId: "title" })}>
      {currentTermsAndConditions.title ?? t("registration.termsAndConditions")}
    </span>
  );
};

export const TermsAndConditionsPage: React.FC<TermsAndConditionsContentProps> = ({
  termsAndConditions,
  locale,
  preview,
}) => {
  // Enable live updates only in preview mode
  const liveTermsAndConditions =
    useContentfulLiveUpdates<PageTermsAndConditionsFieldsFragment | null>(termsAndConditions, {
      locale,
      skip: !preview,
    });

  // Use fallback to original data
  const currentTermsAndConditions = liveTermsAndConditions ?? termsAndConditions;

  // Inspector mode tagging
  const inspectorProps = useContentfulInspectorMode({
    entryId: currentTermsAndConditions?.sys?.id,
    locale,
  });

  // Return early if no data
  if (!termsAndConditions || !currentTermsAndConditions) return <div>No content found.</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-20">
      <h1
        className="text-4xl font-bold tracking-tight sm:text-6xl lg:col-span-2 xl:col-auto"
        {...inspectorProps({ fieldId: "title" })}
      >
        {currentTermsAndConditions.title}
      </h1>

      {/* Content */}
      {currentTermsAndConditions.content?.json ? (
        <div className="mt-16" {...inspectorProps({ fieldId: "content" })}>
          <CtfRichText
            json={currentTermsAndConditions.content.json as Document}
            links={
              currentTermsAndConditions.content.links as {
                entries: {
                  block: EmbeddedEntryType[];
                };
              }
            }
          />
        </div>
      ) : null}
    </div>
  );
};
