import { beforeEach, describe, expect, it } from "vitest";

import { useFlowAnswersStore } from "./use-flow-answers-store";

/**
 * Reset the store to its initial state before each test.
 * Zustand stores persist across tests, so we must re-initialize.
 */
function resetStore() {
  useFlowAnswersStore.setState({
    answersHistory: [],
    autoincrementSettings: {},
    rememberAnswerSettings: {},
  });
}

describe("useFlowAnswersStore", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("initial state", () => {
    it("exposes the correct default values", () => {
      const state = useFlowAnswersStore.getState();
      expect(state.answersHistory).toEqual([]);
      expect(state.autoincrementSettings).toEqual({});
      expect(state.rememberAnswerSettings).toEqual({});
    });
  });

  describe("setAnswer", () => {
    it("stores an answer for cycle 0", () => {
      useFlowAnswersStore.getState().setAnswer(0, "plant", "rose");
      expect(useFlowAnswersStore.getState().answersHistory).toEqual([{ plant: "rose" }]);
    });

    it("pads history with empty cycles when setting a later cycle first", () => {
      useFlowAnswersStore.getState().setAnswer(3, "plant", "rose");
      expect(useFlowAnswersStore.getState().answersHistory).toEqual([
        {},
        {},
        {},
        { plant: "rose" },
      ]);
    });

    it("keeps existing answers in the same cycle and in other cycles", () => {
      const { setAnswer } = useFlowAnswersStore.getState();
      setAnswer(0, "plant", "rose");
      setAnswer(0, "pot", "A1");
      setAnswer(1, "plant", "tulip");
      expect(useFlowAnswersStore.getState().answersHistory).toEqual([
        { plant: "rose", pot: "A1" },
        { plant: "tulip" },
      ]);
    });

    it("overwrites an existing answer for the same cycle and name", () => {
      const { setAnswer } = useFlowAnswersStore.getState();
      setAnswer(0, "plant", "rose");
      setAnswer(0, "plant", "tulip");
      expect(useFlowAnswersStore.getState().getAnswer(0, "plant")).toBe("tulip");
    });

    it("deletes the answer when the value is an empty string", () => {
      const { setAnswer } = useFlowAnswersStore.getState();
      setAnswer(0, "plant", "rose");
      setAnswer(0, "plant", "");
      expect(useFlowAnswersStore.getState().answersHistory).toEqual([{}]);
      expect(useFlowAnswersStore.getState().getAnswer(0, "plant")).toBeUndefined();
    });

    it("treats a whitespace-only value as deletion", () => {
      const { setAnswer } = useFlowAnswersStore.getState();
      setAnswer(0, "plant", "rose");
      setAnswer(0, "plant", "   ");
      expect(useFlowAnswersStore.getState().answersHistory).toEqual([{}]);
    });

    it("stores non-empty values untrimmed", () => {
      useFlowAnswersStore.getState().setAnswer(0, "plant", "  rose  ");
      expect(useFlowAnswersStore.getState().getAnswer(0, "plant")).toBe("  rose  ");
    });

    it("still pads history when an empty value targets a missing cycle", () => {
      useFlowAnswersStore.getState().setAnswer(2, "plant", "");
      expect(useFlowAnswersStore.getState().answersHistory).toEqual([{}, {}, {}]);
    });

    it("does not mutate the previous history array or cycle record", () => {
      useFlowAnswersStore.getState().setAnswer(0, "plant", "rose");
      const prevHistory = useFlowAnswersStore.getState().answersHistory;
      const prevCycle = prevHistory[0];
      useFlowAnswersStore.getState().setAnswer(0, "pot", "A1");
      expect(prevHistory).toEqual([{ plant: "rose" }]);
      expect(prevCycle).toEqual({ plant: "rose" });
      expect(useFlowAnswersStore.getState().answersHistory).not.toBe(prevHistory);
    });

    it("parks a negative cycle on a stray array key that later writes silently drop", () => {
      // quirk: padding never runs for cycle -1, so the answer lands on array key "-1"
      const { setAnswer } = useFlowAnswersStore.getState();
      setAnswer(-1, "plant", "rose");
      const state = useFlowAnswersStore.getState();
      expect(state.answersHistory).toHaveLength(0);
      expect(state.getAnswer(-1, "plant")).toBe("rose");
      // the next setAnswer copies via array spread, which skips non-index keys
      setAnswer(0, "pot", "A1");
      expect(useFlowAnswersStore.getState().getAnswer(-1, "plant")).toBeUndefined();
    });
  });

  describe("getAnswer / getCycleAnswers", () => {
    it("returns undefined for a cycle that does not exist", () => {
      const state = useFlowAnswersStore.getState();
      expect(state.getAnswer(0, "plant")).toBeUndefined();
      expect(state.getCycleAnswers(0)).toBeUndefined();
    });

    it("returns undefined for a missing name in an existing cycle", () => {
      useFlowAnswersStore.getState().setAnswer(0, "plant", "rose");
      expect(useFlowAnswersStore.getState().getAnswer(0, "pot")).toBeUndefined();
    });

    it("getCycleAnswers returns the stored record itself, not a copy", () => {
      useFlowAnswersStore.getState().setAnswer(0, "plant", "rose");
      const state = useFlowAnswersStore.getState();
      expect(state.getCycleAnswers(0)).toEqual({ plant: "rose" });
      expect(state.getCycleAnswers(0)).toBe(state.answersHistory[0]);
    });

    it("returns the padded empty record for intermediate cycles", () => {
      useFlowAnswersStore.getState().setAnswer(2, "plant", "rose");
      expect(useFlowAnswersStore.getState().getCycleAnswers(1)).toEqual({});
    });
  });

  describe("clearHistory", () => {
    it("clears answers and, despite the name, both settings maps", () => {
      const { setAnswer, setAutoincrement, setRememberAnswer } = useFlowAnswersStore.getState();
      setAnswer(0, "plant", "rose");
      setAutoincrement("pot", true);
      setRememberAnswer("plant", true);
      useFlowAnswersStore.getState().clearHistory();
      const state = useFlowAnswersStore.getState();
      expect(state.answersHistory).toEqual([]);
      expect(state.autoincrementSettings).toEqual({});
      expect(state.rememberAnswerSettings).toEqual({});
    });
  });

  describe("clearCycle", () => {
    it("clears only the retried cycle", () => {
      const { setAnswer, clearCycle } = useFlowAnswersStore.getState();
      setAnswer(0, "plant", "rose");
      setAnswer(1, "plant", "tulip");
      clearCycle(1);
      expect(useFlowAnswersStore.getState().answersHistory).toEqual([{ plant: "rose" }, {}]);
    });

    it("ignores a cycle outside the history", () => {
      useFlowAnswersStore.getState().setAnswer(0, "plant", "rose");
      useFlowAnswersStore.getState().clearCycle(2);
      expect(useFlowAnswersStore.getState().answersHistory).toEqual([{ plant: "rose" }]);
    });
  });

  describe("autoincrement settings", () => {
    it("defaults to false for unknown names", () => {
      expect(useFlowAnswersStore.getState().isAutoincrementEnabled("plant")).toBe(false);
    });

    it("toggles per name without touching other names", () => {
      const { setAutoincrement } = useFlowAnswersStore.getState();
      setAutoincrement("plant", true);
      setAutoincrement("pot", false);
      const state = useFlowAnswersStore.getState();
      expect(state.isAutoincrementEnabled("plant")).toBe(true);
      expect(state.isAutoincrementEnabled("pot")).toBe(false);
      expect(state.autoincrementSettings).toEqual({ plant: true, pot: false });
      setAutoincrement("plant", false);
      expect(useFlowAnswersStore.getState().isAutoincrementEnabled("plant")).toBe(false);
    });
  });

  describe("remember-answer settings", () => {
    it("defaults to false for unknown names", () => {
      expect(useFlowAnswersStore.getState().isRememberAnswerEnabled("plant")).toBe(false);
    });

    it("toggles per name, independently of autoincrement", () => {
      const { setRememberAnswer } = useFlowAnswersStore.getState();
      setRememberAnswer("plant", true);
      const state = useFlowAnswersStore.getState();
      expect(state.isRememberAnswerEnabled("plant")).toBe(true);
      expect(state.isAutoincrementEnabled("plant")).toBe(false);
      expect(state.rememberAnswerSettings).toEqual({ plant: true });
      setRememberAnswer("plant", false);
      expect(useFlowAnswersStore.getState().isRememberAnswerEnabled("plant")).toBe(false);
    });
  });
});
