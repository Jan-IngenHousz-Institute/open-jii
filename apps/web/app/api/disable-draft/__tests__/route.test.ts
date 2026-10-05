import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { GET } from "../route";

const disableMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("next/headers", () => ({
  draftMode: vi.fn(() => ({ disable: disableMock })),
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args);
    throw new Error("NEXT_REDIRECT");
  },
}));

describe("GET /api/disable-draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disables draft mode and redirects to the given path", async () => {
    const request = new NextRequest("https://example.com/api/disable-draft?path=%2Fen-US%2Fabout");

    await expect(GET(request)).rejects.toThrow("NEXT_REDIRECT");

    expect(disableMock).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("https://example.com/en-US/about");
  });

  it("redirects home when no path is given", async () => {
    const request = new NextRequest("https://example.com/api/disable-draft");

    await expect(GET(request)).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("https://example.com/");
  });

  it("refuses a path that leaves the site", async () => {
    const request = new NextRequest(
      "https://example.com/api/disable-draft?path=%2F%2Fevil.example%2F",
    );

    const response = await GET(request);

    expect((response as Response).status).toBe(400);
    expect(disableMock).not.toHaveBeenCalled();
  });
});
