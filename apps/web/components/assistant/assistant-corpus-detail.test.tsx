import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { assistantKnowledgeContract } from "@repo/api/domains/assistant-knowledge/assistant-knowledge.contract";

import { AssistantCorpusDetail } from "./assistant-corpus-detail";

const workId = "00000000-0000-4000-8000-000000000101";

describe("AssistantCorpusDetail", () => {
  it("requests the cited work through the access-checked endpoint and hides unavailable sources", async () => {
    const request = server.mount(assistantKnowledgeContract.getCorpusWork, { status: 404 });
    render(<AssistantCorpusDetail workId={workId} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("workspace.error.title");
    expect(request.params).toEqual({ workId });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });
});
