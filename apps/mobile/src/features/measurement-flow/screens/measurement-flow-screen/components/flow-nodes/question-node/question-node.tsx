import { CircleAlert, Repeat2, Search, X, Bookmark, ScanQrCode } from "lucide-react-native";
import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Keyboard } from "react-native";
import { advanceWithAnswer } from "~/features/measurement-flow/services/flow-actions";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { useTranslation } from "~/shared/i18n";
import { FlowNode } from "~/shared/measurements/flow-node";
import { Checkbox } from "~/shared/ui/Checkbox";
import { Input } from "~/shared/ui/Input";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import { QRScannerModal } from "../qr-scanner-modal";
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
  const { t } = useTranslation("measurementFlow");
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
  const [qrMismatch, setQrMismatch] = useState<string | null>(null);

  const openQrScanner = () => {
    setQrMismatch(null);
    setQrScannerVisible(true);
  };

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
          setQrMismatch(data);
          return;
        }
        setQrMismatch(null);
        handleAnswerChangeAndAdvance(match);
        break;
      }
      case "open_ended":
        handleAnswerChange(data);
        break;
      default:
        handleAnswerChange(data);
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
            onQRPress={openQrScanner}
          />
        );
      default:
        return (
          <View className="p-4">
            <Text className="text-muted-foreground text-center">
              {t("measurementFlow:questionNode.unsupportedKind", { kind: content.kind })}
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
              text={t("measurementFlow:questionNode.rememberAnswer")}
              textSize="sm"
              icon={<Bookmark size={16} color={themeColors.onSurface} />}
              onChange={(enabled) => {
                setRememberAnswer(node.id, enabled);
                if (enabled) {
                  setAutoincrement(node.id, false);
                }
              }}
            />
            <Checkbox
              value={isAutoincrementEnabled(node.id)}
              text={t("measurementFlow:questionNode.autoProceed")}
              textSize="sm"
              icon={<Repeat2 size={16} color={themeColors.onSurface} />}
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
            text={t("measurementFlow:questionNode.rememberAnswer")}
            textSize="sm"
            icon={<Bookmark size={16} color={themeColors.onSurface} />}
            onChange={(enabled) => setRememberAnswer(node.id, enabled)}
          />
        )}
      </View>

      {content.kind === "multi_choice" && (
        <Input
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder={t("measurementFlow:questionNode.searchPlaceholder")}
          leftIcon={<Search size={18} color={themeColors.inactive} />}
          rightElement={
            searchTerm.length > 0 ? (
              <TouchableOpacity
                className="bg-gray-background mr-2 rounded-md p-1"
                onPress={() => setSearchTerm("")}
              >
                <X size={20} color={themeColors.onSurface} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                className="bg-gray-background mr-2 rounded-md p-1"
                onPress={openQrScanner}
              >
                <ScanQrCode size={20} color={themeColors.onSurface} />
              </TouchableOpacity>
            )
          }
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={{ marginBottom: 0 }}
        />
      )}

      {content.kind === "multi_choice" && qrMismatch !== null && (
        <View
          className="border-destructive/40 bg-destructive/10 flex-row items-start gap-2 rounded-xl border px-3 py-2"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <CircleAlert size={16} color="hsl(0, 84%, 60%)" style={{ marginTop: 1 }} />
          <Text className="text-destructive flex-1 text-sm">
            {t("measurementFlow:questionNode.qrNotMatch", { data: qrMismatch })}
          </Text>
          <TouchableOpacity
            onPress={() => setQrMismatch(null)}
            hitSlop={8}
            accessibilityLabel={t("measurementFlow:questionNode.qrDismissLabel")}
          >
            <X size={16} color={themeColors.inactive} />
          </TouchableOpacity>
        </View>
      )}
      {content.kind === "multi_choice" ? (
        // FlashList in MultipleChoiceQuestion handles scrolling + virtualization.
        // Wrapping it in a ScrollView would force every option to mount eagerly
        // and tank perf on flows with thousands of options.
        <View className="flex-1">{renderQuestionType()}</View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1">{renderQuestionType()}</View>
        </ScrollView>
      )}
    </View>
  );
}
