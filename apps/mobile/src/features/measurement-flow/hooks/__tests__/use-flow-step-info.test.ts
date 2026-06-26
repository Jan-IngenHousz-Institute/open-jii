import { describe, expect, it } from "vitest";
import type { FlowNode } from "~/features/measurement-flow/screens/measurement-flow-screen/types";

import { __testing_deriveStepInfo as deriveStepInfo } from "../use-flow-step-info";

const node = (id: string, type: FlowNode["type"]): FlowNode =>
  ({ id, type, name: id, content: {}, isStart: false }) as FlowNode;

// [instruction, question, BRANCH, measurement] — one branch in the middle.
const withBranch: FlowNode[] = [
  node("i", "instruction"),
  node("q", "question"),
  node("b", "branch"),
  node("m", "measurement"),
];

describe("deriveStepInfo — branch nodes are excluded from progress", () => {
  it("excludes branch nodes from the total step count", () => {
    const info = deriveStepInfo(withBranch, 0, "exp", false, false);
    // 4 nodes, 1 is a branch → 3 visible steps, not 4.
    expect(info.totalSteps).toBe(3);
  });

  it("does not skip a number when routing past a branch", () => {
    // On the question (idx 1), before the branch.
    expect(deriveStepInfo(withBranch, 1, "exp", false, false).currentStep).toBe(2);
    // On the measurement (idx 3), just after the branch — still step 3, not 4.
    expect(deriveStepInfo(withBranch, 3, "exp", false, false).currentStep).toBe(3);
  });

  it("holds at the previous visible step while sitting on a branch's spinner", () => {
    // Momentarily active on the branch (idx 2): holds at step 2 (the question),
    // does not advance the bar for a node the researcher never acts on.
    const info = deriveStepInfo(withBranch, 2, "exp", false, false);
    expect(info.currentStep).toBe(2);
    expect(info.totalSteps).toBe(3);
  });

  it("counts a questions+branch flow as questions + review, excluding the branch", () => {
    // questions-only flow (branch is transparent) → 2 questions + 1 review = 3.
    const flow: FlowNode[] = [node("q1", "question"), node("b", "branch"), node("q2", "question")];
    const total = deriveStepInfo(flow, 0, "exp", false, false).totalSteps;
    expect(total).toBe(3);
    // On the submit/review screen → last step.
    const review = deriveStepInfo(flow, flow.length, "exp", true, false);
    expect(review.currentStep).toBe(3);
    expect(review.stepTypeKey).toBe("review");
  });

  it("progress never exceeds 1 even on the branch's spinner", () => {
    for (let i = 0; i < withBranch.length; i++) {
      const { progress } = deriveStepInfo(withBranch, i, "exp", false, false);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    }
  });
});
