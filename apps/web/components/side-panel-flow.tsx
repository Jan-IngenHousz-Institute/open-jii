import React, { useState, useEffect } from "react";

import { RichTextarea } from "@repo/ui/components";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components";

interface Question {
  id: number;
  text: string;
  answers: string[];
  isOpenAnswer: boolean;
}

export interface ExperimentSidePanelProps {
  open: boolean;
  nodeType?: string;
  nodeLabel?: string;
  onClose: () => void;
}

export function ExperimentSidePanel({
  open,
  nodeType,
  nodeLabel,
  onClose,
}: ExperimentSidePanelProps) {
  // Keep previous content during transition
  const [displayNodeType, setDisplayNodeType] = useState(nodeType);

  // State for questions and answers
  const [questions, setQuestions] = useState<Question[]>([]);
  const [nextQuestionId, setNextQuestionId] = useState(1);

  // Handler functions
  const addQuestion = () => {
    const newQuestion: Question = {
      id: nextQuestionId,
      text: "",
      answers: [],
      isOpenAnswer: false, // Default to multiple choice
    };
    setQuestions([...questions, newQuestion]);
    setNextQuestionId(nextQuestionId + 1);
  };

  const addAnswer = (questionId: number) => {
    setQuestions(
      questions.map((q) => (q.id === questionId ? { ...q, answers: [...q.answers, ""] } : q)),
    );
  };

  const updateQuestionText = (questionId: number, text: string) => {
    setQuestions(questions.map((q) => (q.id === questionId ? { ...q, text } : q)));
  };

  const toggleQuestionType = (questionId: number) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId
          ? { ...q, isOpenAnswer: !q.isOpenAnswer, answers: !q.isOpenAnswer ? [] : q.answers }
          : q,
      ),
    );
  };

  const updateAnswer = (questionId: number, answerIndex: number, text: string) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              answers: q.answers.map((a, i) => (i === answerIndex ? text : a)),
            }
          : q,
      ),
    );
  };

  const deleteQuestion = (questionId: number) => {
    setQuestions(questions.filter((q) => q.id !== questionId));
  };

  const deleteAnswer = (questionId: number, answerIndex: number) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId ? { ...q, answers: q.answers.filter((_, i) => i !== answerIndex) } : q,
      ),
    );
  };

  useEffect(() => {
    if (open && nodeType) {
      // Immediately update content when opening
      setDisplayNodeType(nodeType);
    } else if (!open) {
      // Delay clearing content until transition ends (300ms)
      const timeout = setTimeout(() => {
        setDisplayNodeType(undefined);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [open, nodeType, nodeLabel]);
  return (
    <>
      {/* Always render backdrop for fade animation */}
      <div
        className={
          "fixed inset-0 top-[-33] z-40 bg-black transition-opacity duration-300 " +
          (open && nodeType
            ? "pointer-events-auto bg-opacity-60 opacity-100"
            : "pointer-events-none bg-opacity-0 opacity-0")
        }
        onClick={onClose}
        aria-label="Close side panel backdrop"
      />
      <div
        className={
          "fixed right-0 top-[-33] z-50 flex h-screen w-[30vw] flex-col rounded-bl-2xl rounded-tl-2xl border-l border-gray-200 bg-white shadow-[-8px_0_30px_-8px_rgba(0,0,0,0.3)] transition-transform duration-300 ease-in-out " +
          (open && nodeType ? "translate-x-0" : "translate-x-full")
        }
      >
        <div className="flex-1 overflow-y-auto p-6">
          <button
            type="button"
            className="text-jii-dark-green hover:text-jii-medium-green absolute right-4 top-4 text-xl font-bold"
            onClick={onClose}
          >
            &times;
          </button>
          <h2 className="text-jii-dark-green mb-4 text-xl font-bold">
            {displayNodeType === "instruction"
              ? "Instruction"
              : displayNodeType === "question"
                ? "Question"
                : ""}{" "}
            Node Panel
          </h2>
          {/* RichTextarea for instruction node */}
          {displayNodeType === "instruction" && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-jii-dark-green">Instruction Details</CardTitle>
              </CardHeader>
              <CardContent>
                <RichTextarea
                  value={""}
                  onChange={(val) => console.log("Instruction details changed:", val)}
                  placeholder="Enter instruction details..."
                />
              </CardContent>
            </Card>
          )}
          {/* Enhanced question/answer UI for question node */}
          {displayNodeType === "question" && (
            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-jii-dark-green">Questions</CardTitle>
                  <span className="bg-jii-dark-green rounded-full px-3 py-1 text-sm font-medium text-white">
                    {questions.length} question{questions.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {/* Dynamic questions/answers UI */}
                <div className="space-y-4">
                  {questions.map((q, index) => (
                    <Card
                      key={q.id}
                      className="border-jii-dark-green/20 bg-jii-dark-green/5 hover:border-jii-dark-green/40 group border-2 shadow-sm transition-all hover:shadow-md"
                    >
                      <CardContent className="p-5">
                        {/* Question Header */}
                        <div className="mb-4 flex items-start gap-3">
                          <div className="bg-jii-dark-green flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              value={q.text}
                              onChange={(e) => updateQuestionText(q.id, e.target.value)}
                              placeholder="Enter your question here..."
                              className="border-jii-dark-green/30 focus:border-jii-dark-green focus:ring-jii-dark-green/20 w-full rounded-md border bg-white px-3 py-2 text-sm font-medium placeholder-gray-400 shadow-sm transition-colors focus:outline-none focus:ring-2"
                            />

                            {/* Question Type Radio Buttons */}
                            <div className="mt-3 flex items-center gap-3">
                              <span className="text-jii-dark-green text-sm font-medium">
                                Question Type:
                              </span>
                              <div className="flex items-center gap-4">
                                <label className="flex cursor-pointer items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`question-type-${q.id}`}
                                    checked={!q.isOpenAnswer}
                                    onChange={() => !q.isOpenAnswer || toggleQuestionType(q.id)}
                                    className="peer sr-only"
                                  />
                                  <span className="border-jii-medium-green peer-checked:border-jii-dark-green peer-checked:bg-jii-dark-green flex aspect-square h-4 w-4 items-center justify-center rounded-full border bg-white transition-colors"></span>
                                  <span className="text-jii-medium-green text-sm">
                                    Multiple Choice
                                  </span>
                                </label>
                                <label className="flex cursor-pointer items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`question-type-${q.id}`}
                                    checked={q.isOpenAnswer}
                                    onChange={() => q.isOpenAnswer || toggleQuestionType(q.id)}
                                    className="peer sr-only"
                                  />
                                  <span className="border-jii-medium-green peer-checked:border-jii-dark-green peer-checked:bg-jii-dark-green flex aspect-square h-4 w-4 items-center justify-center rounded-full border bg-white transition-colors"></span>
                                  <span className="text-jii-medium-green text-sm">Open Answer</span>
                                </label>
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteQuestion(q.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 opacity-0 transition-all hover:bg-red-200 group-hover:opacity-100"
                            title="Delete question"
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>

                        {/* Answers Section - Only show for Multiple Choice questions */}
                        {!q.isOpenAnswer && (
                          <div className="ml-11">
                            <div className="mb-3 flex items-center gap-2">
                              <svg
                                className="text-jii-medium-green h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <span className="text-jii-dark-green text-sm font-medium">
                                Answers ({q.answers.length})
                              </span>
                            </div>

                            {q.answers.length > 0 && (
                              <div className="mb-3 space-y-2">
                                {q.answers.map((a, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <div className="bg-jii-medium-green text-jii-dark-green flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium">
                                      {String.fromCharCode(65 + i)}
                                    </div>
                                    <input
                                      type="text"
                                      value={a}
                                      onChange={(e) => updateAnswer(q.id, i, e.target.value)}
                                      placeholder="Enter answer option..."
                                      className="border-jii-medium-green/40 focus:border-jii-medium-green focus:ring-jii-medium-green/20 flex-1 rounded-md border bg-white px-3 py-1.5 text-sm placeholder-gray-400 shadow-sm transition-colors focus:outline-none focus:ring-2"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => deleteAnswer(q.id, i)}
                                      className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                                      title="Delete answer"
                                    >
                                      <svg
                                        className="h-3 w-3"
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
                            )}

                            {q.answers.length === 0 && (
                              <div className="border-jii-medium-green/30 mb-3 rounded-md border-2 border-dashed p-4 text-center">
                                <svg
                                  className="text-jii-medium-green mx-auto h-6 w-6"
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
                                <p className="text-jii-medium-green mt-1 text-xs">No answers yet</p>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => addAnswer(q.id)}
                              className="border-jii-medium-green text-jii-dark-green hover:border-jii-dark-green hover:bg-jii-dark-green/5 flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-sm font-medium shadow-sm transition-colors"
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
                                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                />
                              </svg>
                              Add Answer
                            </button>
                          </div>
                        )}

                        {/* Open Answer Info */}
                        {q.isOpenAnswer && (
                          <div className="ml-11">
                            <div className="border-jii-medium-green/30 bg-jii-medium-green/5 rounded-md border-2 border-dashed p-4 text-center">
                              <svg
                                className="text-jii-medium-green mx-auto h-8 w-8"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                              <p className="text-jii-dark-green mt-2 text-sm font-medium">
                                Open Answer
                              </p>
                              <p className="text-jii-medium-green mt-1 text-xs">
                                Participants will provide their own written response
                              </p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {questions.length === 0 && (
                    <Card className="border-jii-medium-green/30 border-2 border-dashed p-8 text-center">
                      <CardContent>
                        <svg
                          className="text-jii-medium-green mx-auto h-12 w-12"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <h3 className="text-jii-dark-green mt-2 text-lg font-medium">
                          No questions yet
                        </h3>
                        <p className="text-jii-medium-green mt-1 text-sm">
                          Get started by adding your first question.
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  <button
                    type="button"
                    onClick={addQuestion}
                    className="border-jii-dark-green bg-jii-dark-green/10 text-jii-dark-green hover:border-jii-dark-green hover:bg-jii-dark-green/20 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-sm font-semibold transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Add New Question
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
