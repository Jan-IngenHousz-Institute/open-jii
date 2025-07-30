import React, { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components";

import { QuestionCard } from "../question-card";

interface Question {
  id: number;
  text: string;
  answers: string[];
  isOpenAnswer: boolean;
}

export function QuestionPanel() {
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
  return (
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
        <div className="space-y-4">
          {questions.map((q, index) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={index}
              onUpdateText={updateQuestionText}
              onToggleType={toggleQuestionType}
              onDeleteQuestion={deleteQuestion}
              onAddAnswer={addAnswer}
              onUpdateAnswer={updateAnswer}
              onDeleteAnswer={deleteAnswer}
            />
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
                <h3 className="text-jii-dark-green mt-2 text-lg font-medium">No questions yet</h3>
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
  );
}
