"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import React from "react";

import type { PageFaqFieldsFragment, FaqQuestionFieldsFragment } from "../lib/__generated/sdk";

interface FaqContentProps {
  faq: PageFaqFieldsFragment;
  locale: string;
  preview: boolean;
}

export const FaqContent: React.FC<Omit<FaqContentProps, "translations">> = ({
  faq,
  locale,
  preview,
}) => {
  // Enable live updates only in preview mode using the correct options signature
  const liveFaq = useContentfulLiveUpdates<PageFaqFieldsFragment>(faq, {
    locale,
    skip: !preview,
  });

  // Use fallback to original data
  const currentFaq = liveFaq || faq;

  if (!currentFaq) return <div>No content found.</div>;

  // Extract questions array once
  const questions = currentFaq.questionsCollection?.items || [];

  // Inspector mode tagging
  const inspectorProps = useContentfulInspectorMode({
    entryId: currentFaq?.sys?.id,
    locale,
  });

  // Helper to render the questions list
  const renderQuestionsList = (questions: (FaqQuestionFieldsFragment | null)[]) =>
    questions
      .filter((q): q is FaqQuestionFieldsFragment => q?.__typename === "ComponentFaqQuestion")
      .map((q) => {
        if (!q) return null;
        const questionInspectorProps = useContentfulInspectorMode({
          entryId: q.sys.id,
          locale,
        });
        return (
          <div
            key={q.sys.id}
            className="rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50 via-white to-gray-100 p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <h3
              className="mb-3 text-xl font-semibold text-gray-900"
              {...questionInspectorProps({ fieldId: "question" })}
            >
              {q.question}
            </h3>
            {q.answer?.json && (
              <div
                className="leading-relaxed text-gray-700"
                {...questionInspectorProps({ fieldId: "answer" })}
              >
                {documentToReactComponents(q.answer.json)}
              </div>
            )}
          </div>
        );
      });

  return (
    <>
      <div className="mx-auto mb-12 max-w-4xl text-left">
        <h1
          className="mb-4 text-center text-4xl font-bold text-gray-900"
          {...inspectorProps({ fieldId: "title" })}
        >
          {currentFaq.title}
        </h1>
        {typeof currentFaq.intro === "string" ? (
          <p
            className="mx-auto max-w-2xl text-center text-lg text-gray-600"
            {...inspectorProps({ fieldId: "intro" })}
          >
            {currentFaq.intro}
          </p>
        ) : null}
      </div>
      <div className="mx-auto max-w-4xl space-y-6" {...inspectorProps({ fieldId: `questions` })}>
        {renderQuestionsList(questions)}
      </div>
    </>
  );
};
