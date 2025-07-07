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
  preview: boolean;
}

export const PoliciesContent: React.FC<PoliciesContentProps> = ({ policies, locale, preview }) => {
  // Enable live updates only in preview mode using the correct options signature
  const livePolicies = useContentfulLiveUpdates<PagePoliciesFieldsFragment>(policies, {
    locale,
    skip: !preview,
  });

  // Use fallback to original data
  const currentPolicies = livePolicies || policies;

  if (!currentPolicies) return <div>No content found.</div>;

  // Inspector mode tagging
  const inspectorProps = useContentfulInspectorMode({
    entryId: currentPolicies?.sys?.id,
    locale,
  });

  return (
    <div className="mx-auto flex w-full flex-col items-center">
      <h1
        className="text-jii-dark-green mb-8 w-full text-left text-3xl font-bold tracking-tight"
        {...inspectorProps({ fieldId: "title" })}
      >
        {currentPolicies.title}
      </h1>
      {currentPolicies.content?.json ? (
        <div
          className="prose prose-lg w-full text-gray-700"
          {...inspectorProps({ fieldId: "content" })}
        >
          {documentToReactComponents(currentPolicies.content.json)}
        </div>
      ) : null}
    </div>
  );
};
