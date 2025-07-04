"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import React from "react";

import type { PagePoliciesFieldsFragment } from "../lib/__generated/sdk";

interface PoliciesContentProps {
  policies: PagePoliciesFieldsFragment;
  locale: string;
  preview?: boolean;
}

export const PoliciesContent: React.FC<PoliciesContentProps> = ({
  policies,
  locale,
  preview = false,
}) => {
  // Enable live updates only in preview mode using the correct options signature
  const livePolicies = useContentfulLiveUpdates<PagePoliciesFieldsFragment>(policies, {
    locale,
    skip: !preview,
  });

  // Use fallback to original data
  const currentPolicies = livePolicies || policies;

  // Inspector mode tagging
  const inspectorProps = useContentfulInspectorMode({
    entryId: policies?.sys?.id,
    locale,
  });

  if (!currentPolicies) return <div>No content found.</div>;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
      <h1
        className="text-jii-dark-green mb-8 w-full text-left text-3xl font-bold tracking-tight"
        {...(preview ? inspectorProps({ fieldId: "title" }) : {})}
      >
        {currentPolicies.title}
      </h1>
      {currentPolicies.content?.json ? (
        <div
          className="prose prose-lg w-full text-gray-700"
          {...(preview ? inspectorProps({ fieldId: "content" }) : {})}
        >
          {documentToReactComponents(currentPolicies.content.json)}
        </div>
      ) : null}
    </div>
  );
};
