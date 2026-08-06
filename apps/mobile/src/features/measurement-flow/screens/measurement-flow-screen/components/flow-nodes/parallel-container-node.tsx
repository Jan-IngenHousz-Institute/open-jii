import React, { useRef } from "react";
import { ScrollView, Text, View } from "react-native";
import { seedNextIterationAnswer } from "~/features/measurement-flow/domain/iteration";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { useTranslation } from "~/shared/i18n";
import type { FlowNode, ParallelContent } from "~/shared/measurements/flow-node";
import { Button } from "~/shared/ui/Button";

import { pendingTrackInteractions } from "@repo/workbook";
import type { ParallelLaneAttempt, RunnerState, TrackStatus } from "@repo/workbook";

import { ActiveState } from "../flow-states/active-state";
import { InstructionNode } from "./instruction-node";
import { QuestionNode } from "./question-node/question-node";

const TERMINAL = new Set<TrackStatus>(["done", "partial", "failed", "skipped"]);

function LaneQuestion({ node, trackId }: { node: FlowNode; trackId: string }) {
  const iterationCount = useMeasurementFlowStore((state) => state.iterationCount);
  const continueInteraction = useMeasurementFlowStore(
    (state) => state.continueRunnerTrackInteraction,
  );
  const answer = useFlowAnswersStore((state) => state.getAnswer(iterationCount, node.id) ?? "");
  const { t } = useTranslation("measurementFlow");
  const autoAdvance = node.content.kind === "yes_no" || node.content.kind === "multi_choice";
  const submitAnswer = (value: string) => {
    const answers = useFlowAnswersStore.getState();
    const seed = seedNextIterationAnswer({ node, answerValue: value, iterationCount, answers });
    if (seed) answers.setAnswer(seed.cycle, seed.name, seed.value);
    continueInteraction(trackId, node.id, value);
  };

  return (
    <View className="flex-1">
      <QuestionNode node={node} onAnswerAndAdvance={submitAnswer} />
      {(!autoAdvance || !node.content.required) && (
        <View className="px-4 py-3">
          <Button
            title={t("measurementFlow:navigation.next")}
            onPress={() => submitAnswer(answer)}
            isDisabled={node.content.required && !answer}
          />
        </View>
      )}
    </View>
  );
}

function statusOf(runnerState: Readonly<RunnerState>, lane: ParallelLaneAttempt): TrackStatus {
  return lane.trackId ? (runnerState.tracks[lane.trackId]?.status ?? lane.status) : lane.status;
}

export function ParallelContainerNode({ node }: { node: FlowNode }) {
  const runnerState = useMeasurementFlowStore((state) => state.runnerState);
  const analysisQueue = useMeasurementFlowStore((state) => state.analysisQueue);
  const abandonLane = useMeasurementFlowStore((state) => state.abandonRunnerLane);
  const restartContainer = useMeasurementFlowStore((state) => state.restartRunnerContainer);
  const continueInteraction = useMeasurementFlowStore(
    (state) => state.continueRunnerTrackInteraction,
  );
  const { t } = useTranslation("measurementFlow");
  const presentedTrackRef = useRef<string | null>(null);
  if (!runnerState) return null;

  const attempts = Object.values(runnerState.parallelAttempts).filter(
    (attempt): attempt is NonNullable<typeof attempt> => attempt?.containerCellId === node.id,
  );
  const attempt =
    (runnerState.activeContainerAttemptId
      ? runnerState.parallelAttempts[runnerState.activeContainerAttemptId]
      : undefined) ?? attempts.at(-1);
  if (!attempt) return null;

  const lanes = Object.values(attempt.lanes);
  const laneTrackIds = new Set(
    lanes.flatMap((lane) => (lane.trackId === null ? [] : [lane.trackId])),
  );
  const interactions = pendingTrackInteractions(runnerState).filter(({ trackId }) =>
    laneTrackIds.has(trackId),
  );
  const interactionIds = interactions.map(({ trackId }) => trackId);
  const analysisIds = analysisQueue.flatMap((interaction) =>
    laneTrackIds.has(interaction.trackId) ? [interaction.trackId] : [],
  );
  const liveEffectIds = Object.values(runnerState.inFlight).flatMap((effect) =>
    effect && laneTrackIds.has(effect.trackId) ? [effect.trackId] : [],
  );
  const activeIds = lanes.flatMap((lane) => {
    const track = lane.trackId ? runnerState.tracks[lane.trackId] : undefined;
    return track && !TERMINAL.has(track.status) ? [track.id] : [];
  });
  const candidates =
    interactionIds.length > 0
      ? interactionIds
      : analysisIds.length > 0
        ? analysisIds
        : liveEffectIds.length > 0
          ? liveEffectIds
          : activeIds;
  if (!presentedTrackRef.current || !candidates.includes(presentedTrackRef.current)) {
    presentedTrackRef.current = candidates[0] ?? null;
  }

  const presentedTrackId = presentedTrackRef.current;
  const presentedLane = lanes.find((lane) => lane.trackId === presentedTrackId);
  const presentedTrack = presentedTrackId ? runnerState.tracks[presentedTrackId] : undefined;
  const laneNodes = (node.content as ParallelContent).laneNodes ?? {};
  const presentedNode =
    presentedLane && presentedTrack?.cursor.cellId
      ? laneNodes[presentedLane.laneId]?.find(
          (candidate) => candidate.id === presentedTrack.cursor.cellId,
        )
      : undefined;
  const presentedAnalysis = analysisQueue.find(
    (interaction) =>
      interaction.trackId === presentedTrackId && interaction.cellId === presentedNode?.id,
  );
  const presentedEffect = Object.values(runnerState.inFlight).find(
    (effect) => effect?.trackId === presentedTrackId && effect.cellId === presentedNode?.id,
  );
  const presentedInteraction =
    presentedAnalysis ??
    (presentedEffect
      ? {
          effectId: presentedEffect.effectId,
          trackId: presentedEffect.trackId,
          cellId: presentedEffect.cellId,
          deviceIds: presentedTrack?.deviceIds ?? [],
        }
      : presentedTrackId && presentedNode
        ? {
            effectId: `track:${presentedTrackId}:${presentedNode.id}`,
            trackId: presentedTrackId,
            cellId: presentedNode.id,
            deviceIds: presentedTrack?.deviceIds ?? [],
          }
        : undefined);
  const deviceLabels = new Map(runnerState.devices.map((device) => [device.id, device.label]));

  return (
    <View className="flex-1 gap-3">
      <View className="px-4 pt-2">
        <Text className="text-foreground text-lg font-bold">
          {t("measurementFlow:parallel.title")}
        </Text>
        <Text className="text-muted-foreground text-sm">
          {t("measurementFlow:parallel.attempt", { attempt: attempt.attemptId })}
        </Text>
        {attempt.status === "awaitingRestart" && (
          <View className="pt-3">
            <Button
              title={t("measurementFlow:parallel.restart")}
              onPress={() => restartContainer(attempt.containerCellId, attempt.attemptId)}
            />
          </View>
        )}
      </View>
      <ScrollView
        horizontal
        className="max-h-32"
        contentContainerClassName="gap-3 px-4"
        showsHorizontalScrollIndicator={false}
      >
        {lanes.map((lane) => {
          const status = statusOf(runnerState, lane);
          const track = lane.trackId ? runnerState.tracks[lane.trackId] : undefined;
          const currentNode = track?.cursor.cellId
            ? laneNodes[lane.laneId]?.find((candidate) => candidate.id === track.cursor.cellId)
            : undefined;
          const canAbandon = track !== undefined && !TERMINAL.has(status);
          const statusLabel = t(`measurementFlow:parallel.status.${status}` as const);
          return (
            <View
              key={lane.laneId}
              className="border-border bg-muted min-w-56 gap-1 rounded-xl border p-3"
              accessibilityLabel={`${lane.label || lane.laneId}: ${statusLabel}`}
            >
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-foreground flex-1 font-semibold">
                  {lane.label || lane.laneId}
                </Text>
                <Text className="text-primary text-xs font-semibold">{statusLabel}</Text>
              </View>
              <Text className="text-muted-foreground text-xs">
                {lane.deviceIds.length > 0
                  ? lane.deviceIds.map((id) => deviceLabels.get(id) ?? id).join(", ")
                  : t("measurementFlow:parallel.noDevices")}
              </Text>
              {track?.cursor.cellId && (
                <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                  {currentNode?.name ?? track.cursor.cellId}
                </Text>
              )}
              {canAbandon && lane.trackId && (
                <Button
                  title={t("measurementFlow:parallel.abandon")}
                  variant="danger"
                  size="sm"
                  onPress={() => {
                    if (lane.trackId) abandonLane(lane.trackId);
                  }}
                />
              )}
            </View>
          );
        })}
      </ScrollView>

      <View className="flex-1">
        {presentedNode?.type === "question" && presentedTrackId ? (
          <LaneQuestion node={presentedNode} trackId={presentedTrackId} />
        ) : presentedNode?.type === "instruction" && presentedTrackId ? (
          <View className="flex-1">
            <ScrollView className="flex-1">
              <InstructionNode content={presentedNode.content} />
            </ScrollView>
            <View className="px-4 py-3">
              <Button
                title={t("measurementFlow:navigation.next")}
                onPress={() => continueInteraction(presentedTrackId, presentedNode.id)}
              />
            </View>
          </View>
        ) : presentedNode ? (
          <ActiveState currentNode={presentedNode} interaction={presentedInteraction} />
        ) : (
          <View className="items-center p-6">
            <Text className="text-muted-foreground text-center">
              {t("measurementFlow:parallel.waiting")}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
