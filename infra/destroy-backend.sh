#!/usr/bin/env bash
# Deletes the backend stacks. The database is kept as a final RDS snapshot
# (DeletionPolicy: Snapshot); snapshot storage beyond the free 20 GB is billed.
set -euo pipefail

: "${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID in .env}"
: "${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY in .env}"
: "${AWS_REGION:?Set AWS_REGION in .env}"
export AWS_DEFAULT_REGION="$AWS_REGION" AWS_PAGER=""
[ -n "${AWS_SESSION_TOKEN:-}" ] || unset AWS_SESSION_TOKEN

APP_NAME="${APP_NAME:-meetings}"

read -r -p "Delete stacks $APP_NAME-backend and $APP_NAME-ecr in $AWS_REGION? Type the app name to confirm: " answer
[ "$answer" = "$APP_NAME" ] || { echo "Aborted."; exit 1; }

echo "==> Deleting $APP_NAME-backend (takes several minutes)"
aws cloudformation delete-stack --stack-name "$APP_NAME-backend"
aws cloudformation wait stack-delete-complete --stack-name "$APP_NAME-backend"

echo "==> Deleting images and $APP_NAME-ecr"
aws ecr delete-repository --repository-name "$APP_NAME-backend" --force >/dev/null 2>&1 || true
aws cloudformation delete-stack --stack-name "$APP_NAME-ecr"
aws cloudformation wait stack-delete-complete --stack-name "$APP_NAME-ecr"

echo "Done."
echo "Kept: the final database snapshot (restoring it needs the password in /$APP_NAME/db-password)."
echo "  aws rds describe-db-snapshots --db-instance-identifier $APP_NAME-db"
echo "  aws ssm delete-parameter --name /$APP_NAME/db-password   # once you no longer need it"
