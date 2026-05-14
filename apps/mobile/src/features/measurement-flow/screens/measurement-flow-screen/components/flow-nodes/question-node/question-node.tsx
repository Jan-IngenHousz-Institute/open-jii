import { Repeat2, Search, X, Bookmark, ScanQrCode } from "lucide-react-native";
import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Keyboard } from "react-native";
import { toast } from "sonner-native";
import { Checkbox } from "~/shared/ui/Checkbox";
import { colors } from "~/shared/constants/colors";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

import { FlowNode } from "../../../types";
import { QRScannerModal } from "../qr-scanner-modal";
import { advanceWithAnswer } from "../utils/advance-with-answer";
import { AutoProceededSummary } from "./auto-proceeded-summary";
import { MultipleChoiceQuestion } from "./question-types/multiple-choice-question";
import { NumberQuestion } from "./question-types/number-question";
import { OpenEndedQuestion } from "./question-types/open-ended-question";
import { SingleChoiceQuestion } from "./question-types/single-choice-question";
import { TextQuestion } from "./question-types/text-question";
import { YesNoQuestion } from "./question-types/yes-no-question";

interface QuestionNodeProps {
  node: FlowNode;
}

export function QuestionNode({ node }: QuestionNodeProps) {
  const { iterationCount } = useMeasurementFlowStore();
  const themeColors = useThemeColors();
  const {
    setAnswer,
    getAnswer,
    isAutoincrementEnabled,
    setRememberAnswer,
    isRememberAnswerEnabled,
    setAutoincrement,
  } = useFlowAnswersStore();

  const content = node.content;
  const [searchTerm, setSearchTerm] = useState("");
  const [qrScannerVisible, setQrScannerVisible] = useState(false);

  const answerValue = getAnswer(iterationCount, node.id) ?? "";

  const handleAnswerChange = (value: string) => {
    setAnswer(iterationCount, node.id, value);
  };

  const handleAnswerChangeAndAdvance = (value: string) => {
    Keyboard.dismiss();
    setAnswer(iterationCount, node.id, value);
    advanceWithAnswer(node, value);
  };

  const handleQRScanned = (data: string) => {
    switch (content.kind) {
      case "multi_choice": {
        const match = content.options?.find(
          (opt) => opt.trim().toLowerCase() === data.trim().toLowerCase(),
        );
        if (!match) {
          toast.error(`"${data}" does not exist.`);
          return;
        }
        handleAnswerChangeAndAdvance(match);
        toast.success(`"${match}" selected successfully!`);
        break;
      }
      case "open_ended":
        handleAnswerChange(data);
        toast.success("QR applied successfully!");
        break;
      default:
        handleAnswerChange(data);
        toast.success("QR applied successfully!");
    }
  };

  const renderQuestionType = () => {
    switch (content.kind) {
      case "text":
        return <TextQuestion content={content} value={answerValue} onChange={handleAnswerChange} />;
      case "number":
        return (
          <NumberQuestion content={content} value={answerValue} onChange={handleAnswerChange} />
        );
      case "single_choice":
        return (
          <SingleChoiceQuestion
            content={content}
            selectedValue={answerValue}
            onSelect={handleAnswerChange}
          />
        );
      case "multi_choice":
        return (
          <MultipleChoiceQuestion
            node={node}
            selectedValue={answerValue}
            onSelect={handleAnswerChangeAndAdvance}
            searchTerm={searchTerm}
          />
        );
      case "yes_no":
        return (
          <YesNoQuestion
            content={content}
            selectedValue={answerValue}
            onSelect={handleAnswerChangeAndAdvance}
          />
        );
      case "open_ended":
        return (
          <OpenEndedQuestion
            content={content}
            value={answerValue}
            onChange={handleAnswerChange}
            onQRPress={() => setQrScannerVisible(true)}
          />
        );
      default:
        return (
          <View className="p-4">
            <Text className="text-muted-foreground text-center">
              Unsupported question kind: {content.kind}
            </Text>
          </View>
        );
    }
  };

  return (
    <View className="flex-1 gap-4 rounded-xl px-4 pt-4">
      <AutoProceededSummary currentNodeId={node.id} iterationCount={iterationCount} />
      <Text className="text-foreground text-lg font-bold">{content.text}</Text>
      <QRScannerModal
        visible={qrScannerVisible}
        onClose={() => setQrScannerVisible(false)}
        onScanned={handleQRScanned}
        showMatchNote={content.kind === "multi_choice"}
      />

      <View className="flex-row items-center gap-4">
        {content.kind === "multi_choice" ? (
          <>
            <Checkbox
              value={isRememberAnswerEnabled(node.id)}
              text="Remember answer"
              textSize="sm"
              icon={<Bookmark size={16} color={colors.neutral.black} />}
              onChange={(enabled) => {
                setRememberAnswer(node.id, enabled);
                if (enabled) {
                  setAutoincrement(node.id, false);
                }
              }}
            />
            <Checkbox
              value={isAutoincrementEnabled(node.id)}
              text="Auto proceed"
              textSize="sm"
              icon={<Repeat2 size={16} color={colors.neutral.black} />}
              onChange={(enabled) => {
                setAutoincrement(node.id, enabled);
                if (enabled) {
                  setRememberAnswer(node.id, false);
                }
              }}
            />
          </>
        ) : (
          <Checkbox
            value={isRememberAnswerEnabled(node.id)}
            text="Remember answer"
            textSize="sm"
            icon={<Bookmark size={16} color={colors.neutral.black} />}
            onChange={(enabled) => setRememberAnswer(node.id, enabled)}
          />
        )}
      </View>

      {content.kind === "multi_choice" && (
        <View className="border-border flex-row items-center gap-2 rounded-xl border pl-4 pr-2">
          <Search size={20} color={themeColors.inactive} />

          <TextInput
            className="text-on-surface flex-1 text-base"
            placeholder="Search options..."
            placeholderTextColor={themeColors.inactive}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />

          {searchTerm.length > 0 ? (
            <TouchableOpacity
              className="bg-gray-background rounded-md p-1"
              onPress={() => setSearchTerm("")}
            >
              <X size={20} color={colors.neutral.black} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className="bg-gray-background rounded-md p-1"
              onPress={() => setQrScannerVisible(true)}
            >
              <ScanQrCode size={20} color={colors.neutral.black} />
            </TouchableOpacity>
          )}
        </View>
      )}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1">{renderQuestionType()}</View>
      </ScrollView>
    </View>
  );
}
