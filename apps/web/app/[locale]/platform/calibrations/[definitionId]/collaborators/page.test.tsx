import { createCalibrationDefinitionDetail, readOnlyCapabilities } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { use } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import CalibrationCollaboratorsContent from "./calibration-collaborators-content";
import { generateMetadata } from "./page";

const DEFINITION_ID = "7a54c0bf-8293-4db0-a96f-958dbdfc7648";

function renderPage() {
  return render(
    <CalibrationCollaboratorsContent params={Promise.resolve({ definitionId: DEFINITION_ID })} />,
  );
}

describe("generateMetadata", () => {
  it("titles the route by its collaborators section", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", definitionId: DEFINITION_ID }),
    });

    expect(metadata.title).toBe("sharing.collaboratorsTab");
  });
});

describe("CalibrationCollaboratorsPage", () => {
  beforeEach(() => {
    vi.mocked(use).mockReturnValue({ definitionId: DEFINITION_ID });
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
  });

  // A calibration method is worth more to the institute the further it travels, so it shares
  // like every other resource here.
  it("shows the roster to someone who may share the calibration", async () => {
    server.mount(contract.iot.getCalibrationDefinition, {
      body: createCalibrationDefinitionDetail({ id: DEFINITION_ID }),
    });
    server.mount(contract.sharing.listGrants, { body: [] });

    const { router } = renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sharing.invite/ })).toBeInTheDocument();
    });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("sends a viewer with no sharing surface back to the calibration", async () => {
    server.mount(contract.iot.getCalibrationDefinition, {
      body: createCalibrationDefinitionDetail({
        id: DEFINITION_ID,
        capabilities: readOnlyCapabilities,
      }),
    });

    const { container, router } = renderPage();

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(`/en-US/platform/calibrations/${DEFINITION_ID}`);
    });
    expect(container).toBeEmptyDOMElement();
  });
});
