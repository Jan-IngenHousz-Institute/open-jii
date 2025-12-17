"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import type { Document } from "@contentful/rich-text-types";
import React, { useState } from "react";

import { Button } from "@repo/ui/components";

import type { PageFaqFieldsFragment, FaqQuestionFieldsFragment } from "../lib/__generated/sdk";
import { CtfRichText } from "./contentful/ctf-rich-text";

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
  const questions = currentFaq.questionsCollection?.items ?? [];

  // Inspector mode tagging
  const inspectorProps = useContentfulInspectorMode({
    entryId: currentFaq?.sys?.id,
    locale,
  });

  // State to manage which FAQ is open
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleQuestion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // Helper to render the questions list
  const renderQuestionsList = (questions: (FaqQuestionFieldsFragment | null)[]) =>
    questions
      .filter((q): q is FaqQuestionFieldsFragment => q?.__typename === "ComponentFaqQuestion")
      .map((q, index) => {
        if (!q) return null;
        const questionInspectorProps = useContentfulInspectorMode({
          entryId: q.sys.id,
          locale,
        });
        const isOpen = openIndex === index;

        return (
          <div key={q.sys.id} className="py-6 first:pt-0 last:pb-0">
            <dt>
              <Button
                type="button"
                onClick={() => toggleQuestion(index)}
                aria-expanded={isOpen}
                variant="ghost"
                className="h-auto w-full justify-between gap-0 p-0 hover:bg-transparent"
              >
                <span
                  className="whitespace-normal break-words text-left text-base/7 font-semibold"
                  {...questionInspectorProps({ fieldId: "question" })}
                >
                  {q.question}
                </span>
                <span className="ml-6 flex h-7 items-center">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                    className={`!size-6 transition-all duration-300 ${
                      isOpen ? "rotate-180 opacity-0" : "rotate-0 opacity-100"
                    }`}
                  >
                    <path d="M12 6v12m6-6H6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                    className={`absolute !size-6 transition-all duration-300 ${
                      isOpen ? "rotate-0 opacity-100" : "-rotate-180 opacity-0"
                    }`}
                  >
                    <path d="M18 12H6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Button>
            </dt>
            <dd
              className={`grid pr-12 transition-all duration-500 ease-in-out ${
                isOpen ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                {q.answer?.json && (
                  <div
                    className="text-base/7 text-gray-600"
                    {...questionInspectorProps({ fieldId: "answer" })}
                  >
                    <CtfRichText json={q.answer.json as Document} />
                  </div>
                )}
              </div>
            </dd>
          </div>
        );
      });

  return (
    <div className="from-jii-bright-green/40 relative isolate min-h-screen overflow-hidden bg-gradient-to-br via-white to-white">
      {/* Background skew block */}
      <div
        aria-hidden="true"
        className="shadow-primary/10 ring-jii-bright-green/20 absolute inset-y-0 right-1/2 -z-10 -mr-96 w-[200%] origin-top-right skew-x-[-30deg] bg-white shadow-xl ring-1 sm:-mr-80 lg:-mr-96"
      />

      <div className="mx-auto max-w-4xl px-4 py-20">
        <h1
          className="text-4xl font-bold tracking-tight sm:text-6xl lg:col-span-2 xl:col-auto"
          {...inspectorProps({ fieldId: "title" })}
        >
          {currentFaq.title}
        </h1>
        {currentFaq.intro && (
          <p className="mt-6 text-base/7 text-gray-600" {...inspectorProps({ fieldId: "intro" })}>
            {currentFaq.intro}
          </p>
        )}
        <dl
          className="mt-16 divide-y divide-gray-900/10"
          {...inspectorProps({ fieldId: "questions" })}
        >
          {renderQuestionsList(questions)}
        </dl>
      </div>
    </div>
  );
};
