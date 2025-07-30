import React from "react";

import { Card, CardContent } from "@repo/ui/components";

interface Question {
  id: number;
  text: string;
  answers: string[];
  isOpenAnswer: boolean;
}

interface QuestionCardProps {
  question: Question;
  index: number;
  onUpdateText: (text: string) => void;
  onToggleType: (questionId: number) => void;
  onAddAnswer: (questionId: number) => void;
  onUpdateAnswer: (answerIndex: number, text: string) => void;
  onDeleteAnswer: (questionId: number, answerIndex: number) => void;
}

export function QuestionCard({
  question,
  onUpdateText,
  onToggleType,
  onAddAnswer,
  onUpdateAnswer,
  onDeleteAnswer,
}: QuestionCardProps) {
  return (
    <Card className="group relative overflow-hidden border border-gray-200 bg-white shadow-sm transition-all hover:border-gray-300 hover:shadow-lg">
      {/* Subtle accent line */}
      <div className="from-jii-dark-green to-jii-medium-green absolute left-0 top-0 h-full w-1 bg-gradient-to-b"></div>

      <CardContent className="p-6 pl-8">
        {/* Question Input */}
        <div className="mb-6">
          <input
            type="text"
            value={question.text}
            onChange={(e) => onUpdateText(e.target.value)}
            placeholder="What would you like to ask?"
            className="focus:border-jii-dark-green w-full border-0 border-b-2 border-gray-100 bg-transparent px-0 py-3 text-lg font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0"
          />
        </div>

        {/* Question Type Toggle */}
        <div className="mb-6 flex items-center gap-6">
          <label className="flex cursor-pointer items-center gap-3">
            <div className="relative">
              <input
                type="radio"
                name={`question-type-${question.id}`}
                checked={!question.isOpenAnswer}
                onChange={() => !question.isOpenAnswer || onToggleType(question.id)}
                className="peer sr-only"
              />
              <div className="peer-checked:border-jii-dark-green peer-checked:bg-jii-dark-green peer-focus:ring-jii-dark-green/20 h-4 w-4 rounded-full border-2 border-gray-300 bg-white transition-all peer-focus:ring-2"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-white opacity-0 transition-opacity peer-checked:opacity-100"></div>
              </div>
            </div>
            <span className="text-sm font-medium text-gray-700">Multiple Choice</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <div className="relative">
              <input
                type="radio"
                name={`question-type-${question.id}`}
                checked={question.isOpenAnswer}
                onChange={() => question.isOpenAnswer || onToggleType(question.id)}
                className="peer sr-only"
              />
              <div className="peer-checked:border-jii-dark-green peer-checked:bg-jii-dark-green peer-focus:ring-jii-dark-green/20 h-4 w-4 rounded-full border-2 border-gray-300 bg-white transition-all peer-focus:ring-2"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-white opacity-0 transition-opacity peer-checked:opacity-100"></div>
              </div>
            </div>
            <span className="text-sm font-medium text-gray-700">Open Answer</span>
          </label>
        </div>

        {/* Multiple Choice Answers */}
        {!question.isOpenAnswer && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-gray-400"></div>
              <span className="text-sm font-medium text-gray-600">Answer Options</span>
            </div>

            {question.answers.length > 0 ? (
              <div className="space-y-3">
                {question.answers.map((answer, answerIndex) => (
                  <div key={answerIndex} className="group/answer flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-xs font-medium text-gray-600">
                      {String.fromCharCode(65 + answerIndex)}
                    </div>
                    <input
                      type="text"
                      value={answer}
                      onChange={(e) => onUpdateAnswer(answerIndex, e.target.value)}
                      placeholder="Enter an answer option"
                      className="focus:border-jii-dark-green focus:ring-jii-dark-green/20 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 transition-colors focus:bg-white focus:outline-none focus:ring-2"
                    />
                    <button
                      type="button"
                      onClick={() => onDeleteAnswer(question.id, answerIndex)}
                      className="rounded-lg p-2 text-gray-400 opacity-100 transition-all hover:bg-red-50 hover:text-red-500 md:opacity-0 md:group-hover/answer:opacity-100"
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
              onClick={() => onAddAnswer(question.id)}
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

        {/* Open Answer Display */}
        {question.isOpenAnswer && (
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
            <p className="mb-1 font-medium text-gray-900">Open Answer Response</p>
            <p className="text-sm text-gray-600">Participants can write their own answer</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
