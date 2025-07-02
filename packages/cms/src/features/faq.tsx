"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import React from "react";

import type { PageFaqFieldsFragment, FaqQuestionFieldsFragment } from "../lib/__generated/sdk";

interface FaqContentProps {
  translations: {
    title: string;
    intro: string;
  };
  faq: PageFaqFieldsFragment;
  locale: string;
  preview?: boolean;
}

export const FaqContent: React.FC<FaqContentProps> = ({
  translations,
  faq,
  locale,
  preview = false,
}) => {
  // Enable live updates only in preview mode using the correct options signature
  const liveFaq = useContentfulLiveUpdates<PageFaqFieldsFragment>(faq, {
    locale,
    skip: !preview,
  });

  // Use fallback to original data
  const currentFaq = liveFaq || faq;

  // Inspector mode tagging
  const inspectorProps = useContentfulInspectorMode({
    entryId: faq?.sys?.id,
    locale,
  });

  if (!currentFaq) return <div>No content found.</div>;

  return (
    <>
      <div className="mb-12 text-left">
        <h1
          className="mb-4 text-4xl font-bold text-gray-900 text-center"
          {...(preview ? inspectorProps({ fieldId: "title" }) : {})}
        >
          {currentFaq.title || translations.title}
        </h1>
        {typeof currentFaq.intro === "string" ? (
          <p
            className="mx-auto max-w-2xl text-lg text-gray-600"
            {...(preview ? inspectorProps({ fieldId: "intro" }) : {})}
          >
            {currentFaq.intro || translations.intro}
          </p>
        ) : (
          <p className="mx-auto max-w-2xl text-lg text-gray-600">{translations.intro}</p>
        )}
      </div>
      <div className="space-y-6">
        {(currentFaq.questionsCollection?.items || [])
          .filter((q): q is FaqQuestionFieldsFragment => q?.__typename === "ComponentFaqQuestion")
          .map((q, idx) =>
            q ? (
              <div
                key={q.sys.id}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                {...(preview ? inspectorProps({ fieldId: `questionsCollection.items[${idx}]` }) : {})}
              >
                <h3 className="mb-3 text-xl font-semibold text-gray-900">{q.question}</h3>
                {q.answer?.json && (
                  <div className="leading-relaxed text-gray-700">
                    {documentToReactComponents(q.answer.json)}
                  </div>
                )}
              </div>
            ) : null,
          )}
      </div>
    </>
  );
};
