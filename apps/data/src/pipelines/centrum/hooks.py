# Databricks notebook source
# DBTITLE 1,Event Hook - Slack Notifications
# Pipeline-level @dlt.on_event_hook that posts to Slack when an update fails or
# is stopped. Reads the webhook URL and Databricks host from secret scopes
# named "event-hooks-{environment}".

# COMMAND ----------
from datetime import datetime

import dlt
import requests

from openjii.centrum.runtime import ENVIRONMENT, MONITORING_SLACK_CHANNEL

# COMMAND ----------

@dlt.on_event_hook(max_allowable_consecutive_failures=3)
def send_slack_notifications(event):

    # Get the webhook URL from the secret scope
    SLACK_WEBHOOK_URL = dbutils.secrets.get(scope=f"event-hooks-{ENVIRONMENT}", key="slack-webhook-url")
    SLACK_HEADERS = {
        'Content-Type': 'application/json'
    }

    if (
        event['event_type'] in ['update_progress', 'flow_progress', 'operation_progress']
        and event['details'].get(event['event_type'], {}).get('state') in ['FAILED', 'STOPPED']
    ):
        event_type = event['event_type']
        state = event['details'].get(event['event_type'], {}).get('state')
        pipeline_id = event['origin'].get('pipeline_id')
        pipeline_name = event['origin'].get('pipeline_name')
        update_id = event['origin'].get('update_id')

        color = "#FF0000" if state == 'FAILED' else "#FFA500"

        try:
            databricks_host = dbutils.secrets.get(scope=f"event-hooks-{ENVIRONMENT}", key="databricks-host")
        except Exception:
            databricks_host = None

        if databricks_host:
            workspace_url = databricks_host
            pipeline_url = f"{databricks_host}/pipelines/{pipeline_id}"
            update_url = f"{databricks_host}/pipelines/{pipeline_id}/updates/{update_id}"
        else:
            workspace_url = None
            pipeline_url = None
            update_url = None

        timestamp = event.get('timestamp')
        if timestamp and isinstance(timestamp, (int, float)):
            timestamp = datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S UTC')

        def slack_link(url, text):
            return f"<{url}|{text}>" if url else text

        payload = {
            "channel": MONITORING_SLACK_CHANNEL,
            "text": f"{pipeline_name}: a run has {state.lower()}.",
            "attachments": [
                {
                    "color": color,
                    "fields": [
                        {
                            "title": "Workspace:",
                            "value": slack_link(workspace_url, f"open-jii-databricks-workspace-{ENVIRONMENT}"),
                            "short": True
                        },
                        {
                            "title": "Job:",
                            "value": slack_link(pipeline_url, pipeline_name),
                            "short": True
                        },
                        {
                            "title": "Update:",
                            "value": slack_link(update_url, update_id),
                            "short": True
                        },
                        {
                            "title": "State:",
                            "value": state,
                            "short": True
                        },
                        {
                            "title": "Environment:",
                            "value": ENVIRONMENT.upper(),
                            "short": True
                        },
                        {
                            "title": "Event Type:",
                            "value": event_type,
                            "short": True
                        }
                    ],
                    "actions": [
                        {
                            "type": "button",
                            "text": "View Pipeline",
                            "url": pipeline_url
                        },
                        {
                            "type": "button",
                            "text": "View Workspace",
                            "url": workspace_url
                        }
                    ]
                }
            ]
        }

        try:
            response = requests.post(
                url=SLACK_WEBHOOK_URL,
                headers=SLACK_HEADERS,
                json=payload,
                timeout=10,
            )
            print(f"Slack notification sent: {event_type} - {state}")
        except Exception as e:
            print(f"Failed to send Slack notification: {e}")
