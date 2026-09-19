import { or } from "drizzle-orm";

import { db } from "../../src/database";
import { experiments, flows } from "../../src/schema";
import type { SeedExperiment } from "./types";

/** Flow graphs for three experiments. */
export async function seedFlows(createdExperiments: SeedExperiment[]) {
  // 6. Create flows for 3 experiments
  const ex = createdExperiments;
  const flowGraphs = [
    {
      experimentId: ex[0].id,
      graph: {
        nodes: [
          {
            id: "n1",
            type: "question",
            name: "Select Plot",
            isStart: true,
            content: {
              kind: "multi_choice",
              text: "Which plot are you measuring?",
              options: ["A1", "A2", "B1", "B2", "C1", "C2"],
              required: true,
            },
          },
          {
            id: "n2",
            type: "instruction",
            name: "Position Device",
            isStart: false,
            content: {
              text: "Clamp the device on the third fully expanded leaf from the top of the plant.",
            },
          },
          {
            id: "n3",
            type: "question",
            name: "Leaf Condition",
            isStart: false,
            content: {
              kind: "yes_no",
              text: "Is the leaf visibly healthy (no spots, wilting, or discoloration)?",
              required: true,
            },
          },
          {
            id: "n4",
            type: "question",
            name: "Notes",
            isStart: false,
            content: {
              kind: "open_ended",
              text: "Any additional observations about this plant?",
              required: false,
            },
          },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2", label: null },
          { id: "e2", source: "n2", target: "n3", label: null },
          { id: "e3", source: "n3", target: "n4", label: null },
        ],
      },
    },
    {
      experimentId: ex[1].id,
      graph: {
        nodes: [
          {
            id: "n1",
            type: "question",
            name: "Treatment Group",
            isStart: true,
            content: {
              kind: "multi_choice",
              text: "What is the treatment group?",
              options: ["Control", "Mild Stress", "Severe Stress"],
              required: true,
            },
          },
          {
            id: "n2",
            type: "question",
            name: "Wilting Score",
            isStart: false,
            content: { kind: "open_ended", text: "Rate the wilting score (1-5):", required: true },
          },
          {
            id: "n3",
            type: "instruction",
            name: "Take Measurement",
            isStart: false,
            content: { text: "Place the device on the youngest fully expanded trifoliate leaf." },
          },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2", label: null },
          { id: "e2", source: "n2", target: "n3", label: null },
        ],
      },
    },
    {
      experimentId: ex[3].id,
      graph: {
        nodes: [
          {
            id: "n1",
            type: "question",
            name: "Cultivar ID",
            isStart: true,
            content: { kind: "open_ended", text: "Enter the cultivar identifier:", required: true },
          },
          {
            id: "n2",
            type: "question",
            name: "Growth Stage",
            isStart: false,
            content: {
              kind: "multi_choice",
              text: "Current growth stage?",
              options: ["Tillering", "Stem Extension", "Heading", "Grain Fill"],
              required: true,
            },
          },
          {
            id: "n3",
            type: "instruction",
            name: "Measure Flag Leaf",
            isStart: false,
            content: { text: "Measure the flag leaf at mid-blade, avoiding the midrib." },
          },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2", label: null },
          { id: "e2", source: "n2", target: "n3", label: null },
        ],
      },
    },
  ];

  await db.insert(flows).values(flowGraphs);
  console.log(`  Created ${flowGraphs.length} flows`);
}
