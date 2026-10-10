import { server } from "@/test/msw/server";
import { act, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { http, HttpResponse } from "msw";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ComponentReleaseNoteFieldsFragment } from "@repo/cms";

import { WHATS_NEW_OPEN_EVENT } from "./whats-new-shared";
import { WhatsNewSheet } from "./whats-new-sheet";

vi.mock("@repo/cms/release-notes-feed", () => ({
  ReleaseNotesFeed: ({ entries }: { entries: ComponentReleaseNoteFieldsFragment[] }) => (
    <ul>
      {entries.map((entry) => (
        <li key={entry.sys.id}>{entry.title}</li>
      ))}
    </ul>
  ),
}));

const note = {
  __typename: "ComponentReleaseNote",
  sys: { id: "note-1" },
  title: "Faster tabs",
  publishedAt: "2026-10-01T00:00:00.000Z",
};

function mountNotes() {
  const requests: string[] = [];
  server.use(
    http.get("*/api/release-notes", ({ request }) => {
      requests.push(request.url);
      return HttpResponse.json([note]);
    }),
  );
  return requests;
}

describe("<WhatsNewSheet />", () => {
  it("does not load the notes until the sheet opens", async () => {
    const requests = mountNotes();
    server.mount(contract.users.getWhatsNewSeen, { body: { lastSeenAt: null } });

    render(<WhatsNewSheet releaseDates={[note.publishedAt]} />);

    expect(screen.queryByText("Faster tabs")).not.toBeInTheDocument();
    expect(requests).toHaveLength(0);

    act(() => {
      window.dispatchEvent(new Event(WHATS_NEW_OPEN_EVENT));
    });

    expect(await screen.findByText("Faster tabs")).toBeInTheDocument();
    expect(requests).toHaveLength(1);
  });

  it("marks the notes seen when it closes with unread notes", async () => {
    mountNotes();
    server.mount(contract.users.getWhatsNewSeen, { body: { lastSeenAt: null } });
    const markSeen = server.mount(contract.users.markWhatsNewSeen, {
      body: { lastSeenAt: "2026-10-02T00:00:00.000Z" },
    });
    const user = userEvent.setup();

    render(<WhatsNewSheet releaseDates={[note.publishedAt]} />);
    act(() => {
      window.dispatchEvent(new Event(WHATS_NEW_OPEN_EVENT));
    });
    await screen.findByText("Faster tabs");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(markSeen.called).toBe(true));
  });
});
