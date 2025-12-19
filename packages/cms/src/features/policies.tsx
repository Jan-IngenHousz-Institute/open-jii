"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import type { Document } from "@contentful/rich-text-types";
import React from "react";

import type { PagePoliciesFieldsFragment } from "../lib/__generated/sdk";
import type { EmbeddedEntryType } from "./contentful/ctf-rich-text";
import { CtfRichText } from "./contentful/ctf-rich-text";

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
    <div className="mx-auto max-w-4xl px-4 py-20">
      <h1
        className="text-4xl font-bold tracking-tight sm:text-6xl lg:col-span-2 xl:col-auto"
        {...inspectorProps({ fieldId: "title" })}
      >
        {currentPolicies.title}
      </h1>

      {/* Content */}
      {currentPolicies.content?.json ? (
        <div className="mt-16" {...inspectorProps({ fieldId: "content" })}>
          <CtfRichText
            json={currentPolicies.content.json as Document}
            links={
              currentPolicies.content.links as {
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
