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
  // State for a single question
  const [question, setQuestion] = useState<Question>({
    id: 1,
    text: "",
    answers: [],
    isOpenAnswer: false,
  });

  // Handler functions for single question
  const updateQuestionText = (text: string) => {
    setQuestion((q) => ({ ...q, text }));
  };

  const toggleQuestionType = () => {
    setQuestion((q) => ({
      ...q,
      isOpenAnswer: !q.isOpenAnswer,
      answers: !q.isOpenAnswer ? [] : q.answers,
    }));
  };

  const addAnswer = () => {
    setQuestion((q) => ({ ...q, answers: [...q.answers, ""] }));
  };

  const updateAnswer = (answerIndex: number, text: string) => {
    setQuestion((q) => ({
      ...q,
      answers: q.answers.map((a, i) => (i === answerIndex ? text : a)),
    }));
  };

  const deleteAnswer = (answerIndex: number) => {
    setQuestion((q) => ({
      ...q,
      answers: q.answers.filter((_, i) => i !== answerIndex),
    }));
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-jii-dark-green">Question</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <QuestionCard
            key={question.id}
            question={question}
            index={0}
            onUpdateText={updateQuestionText}
            onToggleType={toggleQuestionType}
            onAddAnswer={addAnswer}
            onUpdateAnswer={updateAnswer}
            onDeleteAnswer={deleteAnswer}
          />
        </div>
      </CardContent>
    </Card>
  );
}
