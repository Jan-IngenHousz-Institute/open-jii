"use strict";

// Handler only: the secret read, the webhook request and the webhook address cache. Reading an
// event, turning it into a Slack message, checking the address and remembering posted ids live in
// @repo/monitoring, copied to ./lib at build time.
const { GetSecretValueCommand, SecretsManagerClient } = require("@aws-sdk/client-secrets-manager");

const { statusEventSchema } = require("./lib/status-events.js");
const { slackMessage } = require("./lib/status-slack.js");
const { PostedIds, webhookUrlOf } = require("./lib/status-slack-delivery.js");

const WEBHOOK_TIMEOUT_MS = 10_000;
// Without throwOnRequestTimeout the SDK only logs a request that outlives its timeout.
const AWS_REQUEST_HANDLER = {
  requestTimeout: 10_000,
  connectionTimeout: 5_000,
  throwOnRequestTimeout: true,
};
const WEBHOOK_CACHE_MS = 15 * 60_000;
const POSTED_IDS_LIMIT = 500;
const MAX_LOGGED_LENGTH = 500;
// Events are public page content, and a failed one is logged whole so it can be replayed by hand.
const MAX_LOGGED_MESSAGE_LENGTH = 20_000;

const secrets = new SecretsManagerClient({ requestHandler: AWS_REQUEST_HANDLER });
// Kept for warm invocations, and dropped after 15 minutes or a failed post so a rotated secret is
// picked up.
let webhookUrl;
let webhookReadAt = 0;

const postedIds = new PostedIds(POSTED_IDS_LIMIT);

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function describeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof Error && error.cause?.code ? ` (${error.cause.code})` : "";
  return `${message}${code}`.slice(0, MAX_LOGGED_LENGTH);
}

// The secret holds the webhook address as plain text. It stays out of every message, and so does
// the address.
async function readWebhookUrl(secretArn) {
  if (webhookUrl !== undefined && Date.now() - webhookReadAt < WEBHOOK_CACHE_MS) {
    return webhookUrl;
  }

  const { SecretString } = await secrets.send(new GetSecretValueCommand({ SecretId: secretArn }));

  webhookUrl = webhookUrlOf(SecretString);
  webhookReadAt = Date.now();
  return webhookUrl;
}

async function postToSlack(url, message) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message),
    });
  } catch (error) {
    throw new Error(`Slack could not be reached: ${describeError(error)}`);
  }

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Slack answered ${response.status}: ${body.slice(0, 200)}`);
  }
}

async function post(secretArn, record) {
  const event = statusEventSchema.parse(JSON.parse(record.Sns.Message));

  if (postedIds.has(event.id)) {
    console.log(JSON.stringify({ skipped: event.type, id: event.id, reason: "already posted" }));
    return;
  }

  await postToSlack(await readWebhookUrl(secretArn), slackMessage(event));
  postedIds.remember(event.id);

  console.log(JSON.stringify({ posted: event.type, id: event.id }));
}

exports.handler = async (snsEvent) => {
  const secretArn = required("STATUS_SLACK_SECRET_ARN");

  // SNS hands a function one message per invocation; the loop keeps a batch in order if that changes.
  for (const record of snsEvent.Records) {
    try {
      await post(secretArn, record);
    } catch (error) {
      webhookUrl = undefined;
      console.error(
        JSON.stringify({
          error: describeError(error),
          messageId: record.Sns?.MessageId,
          message: record.Sns?.Message?.slice(0, MAX_LOGGED_MESSAGE_LENGTH),
        }),
      );
      throw error;
    }
  }
};
