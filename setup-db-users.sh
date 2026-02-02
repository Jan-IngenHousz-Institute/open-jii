#!/bin/bash
# One-time setup script for database application users in AWS

set -e

CLUSTER_NAME="db-migration-runner-dev-cluster"
TASK_DEFINITION="db-migration-runner-dev"
SUBNET_IDS="subnet-xxxxx,subnet-yyyyy"   # Will update from AWS Console
SECURITY_GROUP="sg-xxxxx"                # Will update from AWS Console

echo "🔐 Running one-time database user setup..."
echo "This will create passwords for openjii_writer and openjii_reader"
echo ""
echo "Cluster: $CLUSTER_NAME"
echo "Task: $TASK_DEFINITION"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

# Run the ECS task with password setup command
aws ecs run-task \
  --cluster "$CLUSTER_NAME" \
  --task-definition "$TASK_DEFINITION" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SECURITY_GROUP],assignPublicIp=DISABLED}" \
  --overrides '{
    "containerOverrides": [{
      "name": "db-migration-runner",
      "command": ["node", "dist/scripts/set-app-user-passwords.js"]
    }]
  }'

echo ""
echo "✅ Task started! Check ECS console for logs."
echo "Once complete, the passwords will be in Secrets Manager:"
echo "  - open-jii-prod-db-cluster-writer-credentials"
echo "  - open-jii-prod-db-cluster-reader-credentials"
