import { clsx } from "clsx";
import { Repeat2, Search, X, Bookmark, ScanQrCode } from "lucide-react-native";
import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Keyboard } from "react-native";
import { toast } from "sonner-native";
import { Checkbox } from "~/components/Checkbox";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { FlowNode } from "../../types";
import { QRScannerModal } from "./qr-scanner-modal";
import { MultipleChoiceQuestion } from "./question-types/multiple-choice-question";
import { NumberQuestion } from "./question-types/number-question";
import { OpenEndedQuestion } from "./question-types/open-ended-question";
import { SingleChoiceQuestion } from "./question-types/single-choice-question";
import { TextQuestion } from "./question-types/text-question";
import { YesNoQuestion } from "./question-types/yes-no-question";
import { advanceWithAnswer } from "./utils/advance-with-answer";

interface QuestionNodeProps {
  node: FlowNode;
}

export function QuestionNode({ node }: QuestionNodeProps) {
  const { iterationCount } = useMeasurementFlowStore();
  const theme = useTheme();
  const { classes, colors } = theme;
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

  // Get current answer from store (using node.id as key)
  const answerValue = getAnswer(iterationCount, node.id) ?? "";

  // Handler to update answer in store
  const handleAnswerChange = (value: string) => {
    setAnswer(iterationCount, node.id, value);
  };

  // Handler for yes/no and multi_choice that auto-advances
  const handleAnswerChangeAndAdvance = (value: string) => {
    Keyboard.dismiss();
    // Set the answer
    setAnswer(iterationCount, node.id, value);
    // Use shared utility to advance with proper answer handling
    advanceWithAnswer(node, value);
  };

  // Handler called when a QR code is scanned — routes by question type
  const handleQRScanned = (data: string) => {
    switch (content.kind) {
      case "multi_choice": {
        const match = content.options?.find(
          (opt) => opt.trim().toLowerCase() === data.trim().toLowerCase(),
        );
        if (!match) {
          toast.error("QR doesn't match any options.");
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
      case "number": {
        if (data.trim() === "" || isNaN(Number(data))) {
          toast.error("QR is not a valid number.");
          return;
        }
        handleAnswerChange(data);
        toast.success("QR applied successfully!");
        break;
      }
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
          <NumberQuestion
            content={content}
            value={answerValue}
            onChange={handleAnswerChange}
            onQRPress={() => setQrScannerVisible(true)}
          />
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
            <Text className={clsx("text-center", classes.textSecondary)}>
              Unsupported question kind: {content.kind}
            </Text>
          </View>
        );
    }
  };

  return (
    <View className={clsx("flex-1 gap-4 rounded-xl px-4 pt-4")}>
      <Text className={clsx("text-lg font-bold", classes.text)}>{content.text}</Text>
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
                // Disable autoincrement when remember answer is enabled
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
                // Disable remember answer when autoincrement is enabled
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
        <View
          className={clsx(
            "flex-row items-center gap-2 rounded-xl border pl-4 pr-2",
            classes.border,
          )}
        >
          <Search size={20} color={theme.isDark ? colors.dark.inactive : colors.light.inactive} />

          <TextInput
            className="flex-1 text-base"
            placeholder="Search options..."
            placeholderTextColor={theme.isDark ? colors.dark.inactive : colors.light.inactive}
            style={{ color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface }}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />

          {searchTerm.length > 0 ? (
            <TouchableOpacity
              className="rounded-md p-1"
              style={{
                backgroundColor: theme.isDark
                  ? colors.dark.grayBackground
                  : colors.light.grayBackground,
              }}
              onPress={() => setSearchTerm("")}
            >
              <X size={20} color={colors.neutral.black} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className="rounded-md p-1"
              onPress={() => setQrScannerVisible(true)}
              style={{
                backgroundColor: theme.isDark
                  ? colors.dark.grayBackground
                  : colors.light.grayBackground,
              }}
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
