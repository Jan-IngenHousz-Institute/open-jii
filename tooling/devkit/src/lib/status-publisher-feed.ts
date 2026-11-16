import { GetObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3";

import { statusFeedStateSchema } from "@repo/monitoring/status-feed";
import type { StatusFeedState } from "@repo/monitoring/status-feed";

import type { Target } from "./status-incident-preview.js";

// Written by the status publisher beside its history; the bucket and the profile follow the target.
const FEED_KEY = "status-feed.json";

/** The target publisher's saved state, or nothing before its first run. */
export async function readPublisherFeed(target: Target): Promise<StatusFeedState | undefined> {
  const s3 = new S3Client({ profile: `openjii-${target}` });
  const bucket = `open-jii-status-state-${target}`;

  let text: string | undefined;
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: FEED_KEY }));
    text = await object.Body?.transformToString();
  } catch (error) {
    if (error instanceof NoSuchKey) {
      return undefined;
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Reading s3://${bucket}/${FEED_KEY} failed, so the preview cannot say what Slack was already told. Sign in with aws sso login --sso-session openjii and run again. ${reason}`,
    );
  }

  return text === undefined ? undefined : statusFeedStateSchema.parse(JSON.parse(text));
}
