import pendingMedia from "@/media/pending.json";
import { Callout } from "fumadocs-ui/components/callout";
import type { ComponentProps, ReactElement } from "react";

const pendingRecordings: ReadonlyArray<{ path: string }> = pendingMedia;

export function DocsVideo({ children }: { children: ReactElement<ComponentProps<"video">> }) {
  if (pendingRecordings.some((entry) => entry.path === children.props.src)) {
    return (
      <Callout type="info" title="Recording pending review">
        This walkthrough will appear here after its recording has been reviewed and published.
      </Callout>
    );
  }
  return children;
}
