import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlowNode } from "~/screens/measurement-flow-screen/types";

import { getCachedFirstManualNodeId } from "./auto-proceeded-summary";

// Mock React Native and related UI deps so the component file can be imported in Node
vi.mock("react-native", () => ({ View: "View", Text: "Text" }));
vi.mock("lucide-react-native", () => ({ Repeat2: "Repeat2" }));
vi.mock("react", () => ({ default: { createElement: vi.fn() } }));
vi.mock("~/hooks/use-theme", () => ({ useTheme: vi.fn() }));

const mockFlowStore = { flowNodes: [] as FlowNode[] };
const mockFlowAnswersState = {
  isAutoincrementEnabled: vi.fn((_id: string) => false),
  isRememberAnswerEnabled: vi.fn((_id: string) => false),
};

vi.mock("~/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: { getState: () => mockFlowStore },
}));
vi.mock("~/stores/use-flow-answers-store", () => ({
  useFlowAnswersStore: { getState: () => mockFlowAnswersState },
}));

// Use unique iteration numbers per test so the module-level cache never hits from a previous test
let nextIteration = 1000;
const freshIteration = () => nextIteration++;

const makeQuestion = (id: string): FlowNode =>
  ({ id, type: "question", name: id, content: { kind: "text" } }) as FlowNode;

const makeInstruction = (id: string): FlowNode =>
  ({ id, type: "instruction", name: id, content: {} }) as FlowNode;

beforeEach(() => {
  vi.clearAllMocks();
  mockFlowAnswersState.isAutoincrementEnabled.mockReturnValue(false);
  mockFlowAnswersState.isRememberAnswerEnabled.mockReturnValue(false);
  mockFlowStore.flowNodes = [];
});

describe("getCachedFirstManualNodeId", () => {
  it("returns undefined when there are no nodes", () => {
    mockFlowStore.flowNodes = [];
    expect(getCachedFirstManualNodeId(freshIteration())).toBeUndefined();
  });

  it("returns the id of the first manual question node", () => {
    mockFlowStore.flowNodes = [makeQuestion("q1"), makeQuestion("q2")];
    expect(getCachedFirstManualNodeId(freshIteration())).toBe("q1");
  });

  it("ignores instruction nodes", () => {
    mockFlowStore.flowNodes = [makeInstruction("i1"), makeQuestion("q1"), makeQuestion("q2")];
    expect(getCachedFirstManualNodeId(freshIteration())).toBe("q1");
  });

  it("skips autoincrement question nodes", () => {
    mockFlowStore.flowNodes = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    mockFlowAnswersState.isAutoincrementEnabled.mockImplementation((id) => id === "q1");
    expect(getCachedFirstManualNodeId(freshIteration())).toBe("q2");
  });

  it("skips remember-answer question nodes", () => {
    mockFlowStore.flowNodes = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    mockFlowAnswersState.isRememberAnswerEnabled.mockImplementation((id) => id === "q1");
    expect(getCachedFirstManualNodeId(freshIteration())).toBe("q2");
  });

  it("returns undefined when all questions are autoincrement or remembered", () => {
    mockFlowStore.flowNodes = [makeQuestion("q1"), makeQuestion("q2")];
    mockFlowAnswersState.isAutoincrementEnabled.mockImplementation((id) => id === "q1");
    mockFlowAnswersState.isRememberAnswerEnabled.mockImplementation((id) => id === "q2");
    expect(getCachedFirstManualNodeId(freshIteration())).toBeUndefined();
  });

  it("returns the cached value on repeated calls with the same iteration", () => {
    mockFlowStore.flowNodes = [makeQuestion("q1")];
    const iter = freshIteration();
    getCachedFirstManualNodeId(iter);
    // Reset flowNodes — a re-read would return undefined, but cache should return "q1"
    mockFlowStore.flowNodes = [];
    expect(getCachedFirstManualNodeId(iter)).toBe("q1");
  });

  it("recomputes when the iteration changes", () => {
    mockFlowStore.flowNodes = [makeQuestion("q1"), makeQuestion("q2")];
    expect(getCachedFirstManualNodeId(freshIteration())).toBe("q1");

    mockFlowStore.flowNodes = [makeQuestion("q3"), makeQuestion("q4")];
    mockFlowAnswersState.isAutoincrementEnabled.mockImplementation((id) => id === "q3");
    expect(getCachedFirstManualNodeId(freshIteration())).toBe("q4");
  });
});
