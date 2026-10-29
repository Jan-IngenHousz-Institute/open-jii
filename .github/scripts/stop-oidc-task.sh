#!/usr/bin/env bash
set -euo pipefail
if [[ "${JOB_STATUS:?}" == success || -z "${TASK_ARN:-}" ]]; then
  exit 0
fi
status=$(aws ecs describe-tasks --cluster "$CLUSTER_NAME" --tasks "$TASK_ARN" --query 'tasks[0].lastStatus' --output text)
if [[ "$status" != STOPPED && "$status" != None ]]; then
  aws ecs stop-task --cluster "$CLUSTER_NAME" --task "$TASK_ARN" --reason "Provisioning workflow did not succeed; rerun to resume safely" > /dev/null
fi
