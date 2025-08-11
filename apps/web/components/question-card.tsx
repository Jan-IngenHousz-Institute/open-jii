import React from "react";

import { Card, CardContent } from "@repo/ui/components";

// Local UI-focused question spec (legacy bridge). Replace with backend question content mapping later.
export interface QuestionUI {
  answerType: "TEXT" | "SELECT" | "NUMBER" | "BOOLEAN";
  validationMessage?: string;
  options?: string[];
  required: boolean;
}

interface QuestionCardProps {
  stepSpecification: QuestionUI;
  onUpdateText: (text: string) => void;
  onUpdateAnswerType: (answerType: QuestionUI["answerType"]) => void;
  onToggleRequired: () => void;
  onAddOption: () => void;
  onUpdateOption: (optionIndex: number, text: string) => void;
  onDeleteOption: (optionIndex: number) => void;
}

export function QuestionCard({
  stepSpecification,
  onUpdateText,
  onUpdateAnswerType,
  onToggleRequired,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
}: QuestionCardProps) {
  const { answerType, validationMessage, options, required } = stepSpecification;

  return (
    <Card className="group relative overflow-hidden border border-gray-200 bg-white shadow-sm transition-all hover:border-gray-300 hover:shadow-lg">
      {/* Subtle accent line */}
      <div className="from-jii-dark-green to-jii-medium-green absolute left-0 top-0 h-full w-1 bg-gradient-to-b"></div>

      <CardContent className="p-6 pl-8">
        {/* Question Input */}
        <div className="mb-6">
          <input
            type="text"
            value={validationMessage ?? ""}
            onChange={(e) => onUpdateText(e.target.value)}
            placeholder="What would you like to ask?"
            className="focus:border-jii-dark-green w-full border-0 border-b-2 border-gray-100 bg-transparent px-0 py-3 text-lg font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0"
          />
        </div>

        {/* Required Toggle */}
        <div className="mb-6">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Required Question</p>
              <p className="text-xs text-gray-500">
                Participants must answer this question to continue
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={required}
                onChange={onToggleRequired}
                className="peer sr-only"
              />
              <div className="peer-checked:bg-jii-dark-green peer-focus:ring-jii-dark-green/20 peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4"></div>
            </label>
          </div>
        </div>

        {/* Question Type Selection */}
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-gray-400"></div>
            <span className="text-sm font-medium text-gray-600">Answer Type</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {["TEXT", "SELECT", "NUMBER", "BOOLEAN"].map((type) => (
              <label key={type} className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="answer-type"
                  checked={answerType === type}
                  onChange={() => onUpdateAnswerType(type as QuestionUI["answerType"])}
                  className="peer sr-only"
                />
                <div className="peer-checked:border-jii-dark-green peer-checked:bg-jii-dark-green peer-focus:ring-jii-dark-green/20 relative h-4 w-4 rounded-full border-2 border-gray-300 bg-white transition-all peer-focus:ring-2">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-white opacity-0 transition-opacity peer-checked:opacity-100"></div>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {type === "TEXT" && "Text"}
                  {type === "SELECT" && "Multiple Choice"}
                  {type === "NUMBER" && "Number"}
                  {type === "BOOLEAN" && "Yes/No"}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Answer Type Specific Content */}
        {answerType === "SELECT" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-gray-400"></div>
              <span className="text-sm font-medium text-gray-600">Answer Options</span>
            </div>

            {options && options.length > 0 ? (
              <div className="space-y-3">
                {options.map((option, optionIndex) => (
                  <div key={optionIndex} className="group/option flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-xs font-medium text-gray-600">
                      {String.fromCharCode(65 + optionIndex)}
                    </div>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => onUpdateOption(optionIndex, e.target.value)}
                      placeholder="Enter an answer option"
                      className="focus:border-jii-dark-green focus:ring-jii-dark-green/20 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 transition-colors focus:bg-white focus:outline-none focus:ring-2"
                    />
                    <button
                      type="button"
                      onClick={() => onDeleteOption(optionIndex)}
                      className="rounded-lg p-2 text-gray-400 opacity-100 transition-all hover:bg-red-50 hover:text-red-500 md:opacity-0 md:group-hover/option:opacity-100"
                      title="Remove option"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
                <div className="mx-auto mb-3 w-fit rounded-full bg-gray-100 p-3">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">No answer options yet</p>
              </div>
            )}

            <button
              type="button"
              onClick={onAddOption}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Add Option
            </button>
          </div>
        )}

        {/* Text Answer Display */}
        {answerType === "TEXT" && (
          <div className="from-jii-medium-green/10 to-jii-dark-green/10 rounded-lg bg-gradient-to-r p-6 text-center">
            <div className="mx-auto mb-3 w-fit rounded-full bg-white p-3 shadow-sm">
              <svg
                className="text-jii-dark-green h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </div>
            <p className="mb-1 font-medium text-gray-900">Text Response</p>
            <p className="text-sm text-gray-600">Participants can write their own answer</p>
          </div>
        )}

        {/* Number Answer Display */}
        {answerType === "NUMBER" && (
          <div className="rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 p-6 text-center">
            <div className="mx-auto mb-3 w-fit rounded-full bg-white p-3 shadow-sm">
              <svg
                className="h-5 w-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                />
              </svg>
            </div>
            <p className="mb-1 font-medium text-gray-900">Number Response</p>
            <p className="text-sm text-gray-600">Participants will enter a numeric value</p>
          </div>
        )}

        {/* Boolean Answer Display */}
        {answerType === "BOOLEAN" && (
          <div className="rounded-lg bg-gradient-to-r from-green-50 to-green-100 p-6 text-center">
            <div className="mx-auto mb-3 w-fit rounded-full bg-white p-3 shadow-sm">
              <svg
                className="h-5 w-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="mb-1 font-medium text-gray-900">Yes/No Response</p>
            <p className="text-sm text-gray-600">Participants will choose Yes or No</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
